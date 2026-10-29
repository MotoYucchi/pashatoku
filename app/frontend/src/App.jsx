import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Cookies from 'js-cookie';
import TermsModal from './TermsModal';
import PixelIcon from './PixelIcon';

// GPS距離計算 (Haversine formula)
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatSeconds(sec) {
  if (sec === null || sec === undefined || sec < 0) return '00:00:00';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const hms = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return d > 0 ? `${d}日 ${hms}` : hms;
}

function extractCodeFromInput(raw) {
  if (!raw) return '';
  let text = raw.trim();
  try {
    const url = new URL(text);
    const params = new URLSearchParams(url.search);
    if (params.has('code')) {
      return params.get('code').trim();
    }
  } catch (e) {
    // Plain code string
  }
  return text;
}

function App() {
  const [tosAgreed, setTosAgreed] = useState(false);
  const [hostTosAgreed, setHostTosAgreed] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [userId, setUserId] = useState(null);

  const [isRegistered, setIsRegistered] = useState(false);
  const [viewMode, setViewMode] = useState('quiz'); // 'quiz' or 'history'
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [error, setError] = useState('');
  const [quizCode, setQuizCode] = useState(null);
  const [manualCodeInput, setManualCodeInput] = useState('');

  const [quizData, setQuizData] = useState(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // 回答状態管理
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [effectiveDisplay, setEffectiveDisplay] = useState('immediate'); // 'immediate' or 'after_end'
  const [correctIndex, setCorrectIndex] = useState(-1);

  // ロック・ヒント・GPS
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [hintUsed, setHintUsed] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [gpsVerified, setGpsVerified] = useState(false);

  // タイマー状態（サーバー時刻とのズレ補正付き）
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [globalTimerEndAt, setGlobalTimerEndAt] = useState(null);
  const [isGlobalEnded, setIsGlobalEnded] = useState(false);
  const [globalTimeLeft, setGlobalTimeLeft] = useState(null);

  // URLパラメータから初期コード取得
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    if (codeFromUrl) {
      setQuizCode(codeFromUrl.trim());
    }
  }, []);

  // Cookieから登録状態を復元
  useEffect(() => {
    const savedName = Cookies.get('pashatoku_name');
    const savedId = Cookies.get('pashatoku_studentid');
    const savedUserId = Cookies.get('pashatoku_user_id');
    const savedTos = Cookies.get('pashatoku_tos_agreed');

    if (savedName && savedUserId && savedTos === 'true') {
      setName(savedName);
      setStudentId(savedId || 'GUEST');
      const uid = parseInt(savedUserId, 10);
      setUserId(uid);
      setTosAgreed(true);
      setHostTosAgreed(true);
      setIsRegistered(true);
      fetchAnsweredQuestions(uid);
    }
  }, []);

  const fetchAnsweredQuestions = async (uid) => {
    if (!uid) return;
    try {
      const res = await axios.get(`/api/user/${uid}/answered`);
      setAnsweredQuestionIds(res.data || []);
    } catch (e) {}
  };

  const fetchHistory = useCallback(async (uid = userId) => {
    if (!uid) return;
    setIsLoadingHistory(true);
    try {
      const res = await axios.get(`/api/user/${uid}/history`);
      setHistoryData(res.data || []);
    } catch (e) {
    } finally {
      setIsLoadingHistory(false);
    }
  }, [userId]);

  const startQuizByCode = useCallback(async (targetCode) => {
    const cleanCode = extractCodeFromInput(targetCode || quizCode);
    if (!cleanCode) return;
    setIsLoadingQuiz(true);
    setError('');
    try {
      const res = await axios.get(`/api/quizzes?code=${encodeURIComponent(cleanCode)}`);
      setQuizCode(cleanCode);
      setQuizData(res.data);
      setCurrentQIndex(0);
      setScore(0);
      setIsFinished(false);
      setSelectedOption(null);
      setShowAnswer(false);
      setHintUsed(false);
      setExplanation('');
      setIsLocked(false);
      setLockMessage('');
      setGpsVerified(false);
      setViewMode('quiz');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        setError('このクイズイベントは現在閉鎖されています。');
      } else {
        setError(`コード「${cleanCode}」のクイズが見つかりませんでした。もう一度確認してください。`);
      }
      setQuizCode(null);
      setQuizData(null);
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [quizCode]);

  // 統合ポーリング（/api/sync）: 全体タイマー・外部QRスキャン・クイズ進行状態を1回の通信で高速同期
  useEffect(() => {
    let isMounted = true;
    const syncState = async () => {
      if (document.hidden) return;
      try {
        const params = new URLSearchParams();
        if (isRegistered && userId && !quizCode && !quizData && viewMode === 'quiz') {
          params.set('user_id', String(userId));
        }
        if (quizCode) {
          params.set('code', quizCode);
        }

        const res = await axios.get(`/api/sync?${params.toString()}`);
        if (!isMounted) return;
        const data = res.data;

        if (data.server_time) {
          const srvMs = new Date(data.server_time).getTime();
          if (!Number.isNaN(srvMs)) {
            setServerOffsetMs(srvMs - Date.now());
          }
        }

        setGlobalTimerEndAt(data.global_timer_end_at || null);

        // 外部カメラ/Pythonからのスキャン受信
        if (data.external_code && !quizCode && !quizData) {
          const extCode = extractCodeFromInput(data.external_code);
          if (extCode) {
            setQuizCode(extCode);
            startQuizByCode(extCode);
          }
        }

        // 現在開いているクイズのステータス同期
        if (data.quiz_status && quizData) {
          const st = data.quiz_status;
          if (st.visibility === 'closed') {
            setError('このクイズイベントは主催者により閉鎖されました。');
            setQuizData(null);
            setQuizCode(null);
            return;
          }

          if (quizData.play_status !== st.play_status || quizData.result_display !== st.result_display) {
            if (st.play_status === 'started' && quizData.play_status === 'waiting') {
              startQuizByCode(quizCode);
            } else {
              setQuizData((prev) =>
                prev
                  ? {
                      ...prev,
                      play_status: st.play_status,
                      result_display: st.result_display || prev.result_display,
                      timer_end_at: st.timer_end_at || prev.timer_end_at,
                    }
                  : prev
              );
            }
          }
        }
      } catch (e) {
        // Ignore transient network errors
      }
    };

    syncState();
    const interval = setInterval(syncState, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isRegistered, userId, quizCode, quizData, viewMode, startQuizByCode]);

  // 全体タイマーのカウントダウン計算
  useEffect(() => {
    if (!globalTimerEndAt) {
      setGlobalTimeLeft(null);
      setIsGlobalEnded(false);
      return;
    }
    const end = new Date(globalTimerEndAt).getTime();
    const tick = () => {
      const now = Date.now() + serverOffsetMs;
      const diff = Math.floor((end - now) / 1000);
      if (diff <= 0) {
        setGlobalTimeLeft(0);
        setIsGlobalEnded(true);
      } else {
        setGlobalTimeLeft(diff);
        setIsGlobalEnded(false);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [globalTimerEndAt, serverOffsetMs]);

  // クイズ個別タイマーのカウントダウン計算
  useEffect(() => {
    if (quizData && quizData.timer_end_at && quizData.play_status === 'started') {
      const end = new Date(quizData.timer_end_at).getTime();
      const tick = () => {
        const now = Date.now() + serverOffsetMs;
        const diff = Math.floor((end - now) / 1000);
        if (diff <= 0) {
          setTimeLeft(0);
          setQuizData((prev) => (prev ? { ...prev, play_status: 'ended' } : prev));
        } else {
          setTimeLeft(diff);
        }
      };
      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [quizData, serverOffsetMs]);

  // 履歴画面を開いているとき、開催中のクイズが終了したら自動で結果が解放されるよう定期更新
  useEffect(() => {
    if (viewMode === 'history' && isRegistered && userId) {
      fetchHistory(userId);
      const int = setInterval(() => {
        if (!document.hidden) fetchHistory(userId);
      }, 4000);
      return () => clearInterval(int);
    }
  }, [viewMode, isRegistered, userId, fetchHistory]);

  // QRコードスキャナーの起動とクリーンアップ
  useEffect(() => {
    if (isRegistered && viewMode === 'quiz' && !quizCode && !quizData && !isGlobalEnded) {
      let scanner = null;
      const timer = setTimeout(() => {
        const el = document.getElementById('reader');
        if (!el) return;
        scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 220 }, false);
        scanner.render(
          (decodedText) => {
            const code = extractCodeFromInput(decodedText);
            if (code) {
              scanner.clear().catch(() => {});
              setQuizCode(code);
              startQuizByCode(code);
            }
          },
          () => {}
        );
      }, 150);

      return () => {
        clearTimeout(timer);
        if (scanner) {
          scanner.clear().catch(() => {});
        }
      };
    }
  }, [isRegistered, viewMode, quizCode, quizData, isGlobalEnded, startQuizByCode]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('お名前（ニックネーム）を入力してください。');
      return;
    }
    if (!tosAgreed || !hostTosAgreed) {
      setError('2つの利用規約にチェックを入れて同意してください。');
      return;
    }
    const cleanId = studentId.trim() || 'GUEST';
    try {
      const res = await axios.post(`/api/user/register`, {
        name: name.trim(),
        student_id: cleanId,
      });
      Cookies.set('pashatoku_name', name.trim(), { expires: 30 });
      Cookies.set('pashatoku_studentid', cleanId, { expires: 30 });
      Cookies.set('pashatoku_user_id', res.data.id.toString(), { expires: 30 });
      Cookies.set('pashatoku_tos_agreed', 'true', { expires: 30 });

      setUserId(res.data.id);
      setStudentId(cleanId);
      setIsRegistered(true);
      fetchAnsweredQuestions(res.data.id);

      if (quizCode) {
        startQuizByCode(quizCode);
      }
    } catch (err) {
      setError(err.response?.data || '登録できませんでした。お名前に記号が入っていないか確認してください。');
    }
  };

  const handleResetRegistration = () => {
    Cookies.remove('pashatoku_name');
    Cookies.remove('pashatoku_studentid');
    Cookies.remove('pashatoku_user_id');
    Cookies.remove('pashatoku_tos_agreed');
    setIsRegistered(false);
    setQuizCode(null);
    setQuizData(null);
    setAnsweredQuestionIds([]);
    setHistoryData([]);
  };

  const verifyGps = (targetLat, targetLng, radius) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('お使いの端末は位置情報（GPS）に対応していません。');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = getDistanceFromLatLonInM(pos.coords.latitude, pos.coords.longitude, targetLat, targetLng);
          if (dist <= radius) {
            resolve(true);
          } else {
            reject(`指定された場所から離れています（あと約 ${Math.round(dist)} m 近づいてください）`);
          }
        },
        () => reject('位置情報が取得できませんでした。端末のGPS設定をオンにしてください。'),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  useEffect(() => {
    if (!quizData || quizData.play_status !== 'started' || !quizData.questions || quizData.questions.length === 0) return;
    const q = quizData.questions[currentQIndex];
    if (quizData.mode === 'gps' && q.lat && q.lng && !gpsVerified) {
      setGpsError('現在地をチェックしています...');
      verifyGps(q.lat, q.lng, q.radius || 50)
        .then(() => {
          setGpsVerified(true);
          setGpsError('');
        })
        .catch((err) => {
          setGpsError(err);
        });
    } else {
      setGpsVerified(true);
    }
  }, [quizData, currentQIndex, gpsVerified]);

  const handleOptionSelect = async (index) => {
    if (showAnswer || isLocked) return;
    setError('');
    try {
      const currentQ = quizData.questions[currentQIndex];
      const payload = {
        user_id: userId,
        question_id: currentQ.id,
        selected_index: index,
        answer_text: '',
        used_hint: hintUsed,
      };

      const res = await axios.post(`/api/quizzes/answer`, payload);

      if (res.data.is_locked) {
        setIsLocked(true);
        setLockMessage(res.data.message);
        return;
      }

      const dispMode = res.data.effective_display || 'immediate';
      setSelectedOption(index);
      setEffectiveDisplay(dispMode);
      setIsCorrect(res.data.is_correct);
      setAwardedPoints(res.data.points_awarded);
      setExplanation(res.data.explanation || '');
      setCorrectIndex(res.data.correct_index !== undefined ? res.data.correct_index : -1);
      setScore((prev) => prev + res.data.points_awarded);
      setShowAnswer(true);
      setAnsweredQuestionIds((prev) => [...prev, currentQ.id]);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        setError('この問題はすでに回答済みです。');
        setAnsweredQuestionIds((prev) => [...prev, quizData.questions[currentQIndex].id]);
      } else {
        setError('通信エラーが発生しました。もう一度ボタンを押してください。');
      }
    }
  };

  const nextQuestion = () => {
    if (currentQIndex < quizData.questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setSelectedOption(null);
      setShowAnswer(false);
      setHintUsed(false);
      setExplanation('');
      setIsLocked(false);
      setLockMessage('');
      setGpsVerified(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setIsFinished(true);
      fetchHistory(userId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const resetToScanner = () => {
    setQuizData(null);
    setQuizCode(null);
    setManualCodeInput('');
    setIsFinished(false);
    setSelectedOption(null);
    setShowAnswer(false);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const optionStyles = [
    { label: 'A', badgeBg: 'bg-red-600 text-white', hoverBg: 'hover:bg-red-50' },
    { label: 'B', badgeBg: 'bg-blue-700 text-white', hoverBg: 'hover:bg-blue-50' },
    { label: 'C', badgeBg: 'bg-amber-500 text-gray-900', hoverBg: 'hover:bg-amber-50' },
    { label: 'D', badgeBg: 'bg-emerald-700 text-white', hoverBg: 'hover:bg-emerald-50' },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-[#FFFDF7] text-gray-900 flex flex-col">
      <TermsModal isOpen={activeModal !== null} onClose={() => setActiveModal(null)} type={activeModal} />

      {/* 固定解除・通常の文書フローに配置した見やすいタイマー＆ヘッダー領域（他の要素と絶対に被らない設計） */}
      <div className="w-full border-b-[3px] border-gray-900 bg-white sticky top-0 z-30 shadow-sm">
        {/* 1. 全体時間バー & クイズ個別時間バー（横並びまたは縦積みでスッキリ整理） */}
        {((globalTimeLeft !== null && !isGlobalEnded) ||
          (quizData && quizData.timer_end_at && quizData.play_status === 'started' && timeLeft !== null)) && (
          <div className="w-full bg-gray-900 text-white px-3 py-2 border-b-[3px] border-gray-900">
            <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              {globalTimeLeft !== null && !isGlobalEnded && (
                <div className="flex items-center gap-2 bg-red-700 px-3 py-1 rounded-lg border-2 border-white">
                  <PixelIcon name="globe" size={22} />
                  <span className="text-xs sm:text-sm font-black">全体のこり時間:</span>
                  <span className="text-base sm:text-lg font-mono font-black tracking-wider bg-black/30 px-2 py-0.5 rounded">
                    {formatSeconds(globalTimeLeft)}
                  </span>
                </div>
              )}

              {quizData && quizData.timer_end_at && quizData.play_status === 'started' && timeLeft !== null && (
                <div className="flex items-center gap-2 bg-amber-400 text-gray-900 px-3 py-1 rounded-lg border-2 border-gray-900">
                  <PixelIcon name="clock" size={22} />
                  <span className="text-xs sm:text-sm font-black">このクイズのこり:</span>
                  <span className="text-base sm:text-lg font-mono font-black tracking-wider bg-white px-2 py-0.5 rounded border border-gray-900">
                    {formatSeconds(timeLeft)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. メインヘッダー＆ナビゲーションボタン */}
        <header className="max-w-2xl mx-auto w-full px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetToScanner}
              className="flex items-center gap-2.5 text-left focus:outline-none"
            >
              <div className="p-1.5 bg-amber-200 border-2 border-gray-900 rounded-xl">
                <PixelIcon name="camera" size={34} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 leading-none">
                  パシャトク
                </h1>
                <p className="text-xs sm:text-sm font-bold text-gray-700 mt-0.5">
                  カメラでパシャ！歩いて解くクイズ
                </p>
              </div>
            </button>
          </div>

          {isRegistered && (
            <nav className="flex w-full sm:w-auto gap-2">
              <button
                type="button"
                onClick={() => setViewMode('quiz')}
                className={`flex-1 sm:flex-initial tactile-btn px-4 py-2.5 font-black text-base flex items-center justify-center gap-2 ${
                  viewMode === 'quiz'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-100'
                }`}
              >
                <PixelIcon name="camera" size={22} />
                <span>クイズを解く</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('history');
                  fetchHistory(userId);
                }}
                className={`flex-1 sm:flex-initial tactile-btn px-4 py-2.5 font-black text-base flex items-center justify-center gap-2 ${
                  viewMode === 'history'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-100'
                }`}
              >
                <PixelIcon name="trophy" size={22} />
                <span>けっか・履歴</span>
              </button>
            </nav>
          )}
        </header>
      </div>

      {/* メインコンテンツ領域（スマホの下部ナビゲーションバーでも見切れないよう十分な下部余白 pb-safe-screen を確保） */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-5 pb-safe-screen">
        {/* サービス全体終了時 */}
        {isGlobalEnded ? (
          <div className="tactile-card p-6 sm:p-8 text-center bg-red-50 my-4">
            <div className="flex justify-center mb-4">
              <PixelIcon name="stop" size={64} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-red-700 mb-3">
              クイズの時間が終了しました！
            </h2>
            <p className="text-lg font-bold text-gray-800 mb-6">
              たくさんのご参加ありがとうございました！下のボタンから、あなたが解いた問題の正解と解説を見ることができます。
            </p>
            <button
              type="button"
              onClick={() => {
                setViewMode('history');
                setIsGlobalEnded(false);
                fetchHistory(userId);
              }}
              className="w-full tactile-btn bg-emerald-700 hover:bg-emerald-600 text-white py-4 px-6 font-black text-xl flex items-center justify-center gap-3"
            >
              <PixelIcon name="trophy" size={28} />
              <span>自分のけっか・解説を見る</span>
            </button>
          </div>
        ) : viewMode === 'history' && isRegistered ? (
          /* ==========================================
             プレイヤー用「けっか・履歴」ダッシュボード
             ========================================== */
          <div className="space-y-6">
            <div className="tactile-card p-5 bg-emerald-50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <PixelIcon name="trophy" size={44} />
                <div>
                  <h2 className="text-2xl font-black text-gray-900">
                    {name} さんのプレイけっか
                  </h2>
                  <p className="text-sm sm:text-base font-bold text-gray-700">
                    これまでに挑戦したクイズの得点と、問題の正解・解説が確認できます。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchHistory(userId)}
                className="tactile-btn bg-white hover:bg-gray-100 text-gray-900 px-4 py-2 font-black text-sm whitespace-nowrap"
              >
                最新の情報に更新
              </button>
            </div>

            {isLoadingHistory && historyData.length === 0 ? (
              <div className="tactile-card p-8 text-center font-black text-lg">
                けっかを読み込んでいます...
              </div>
            ) : historyData.length === 0 ? (
              <div className="tactile-card p-8 text-center space-y-4">
                <div className="flex justify-center">
                  <PixelIcon name="camera" size={56} />
                </div>
                <p className="text-xl font-black text-gray-800">
                  まだ回答したクイズがありません！
                </p>
                <p className="text-base font-bold text-gray-600">
                  教室にあるQRコードを読み取って、クイズに答えるとここに結果が表示されます。
                </p>
                <button
                  type="button"
                  onClick={() => setViewMode('quiz')}
                  className="tactile-btn bg-blue-700 text-white px-8 py-4 font-black text-lg inline-flex items-center gap-2"
                >
                  <PixelIcon name="camera" size={24} />
                  <span>クイズ画面へ行く</span>
                </button>
              </div>
            ) : (
              historyData.map((h) => {
                const isEnded = h.play_status === 'ended';
                const anyPendingAfterEnd =
                  !isEnded &&
                  h.questions &&
                  h.questions.some((q) => q.selected_index !== undefined && !q.can_view_detail);

                return (
                  <div key={h.quiz_id} className="tactile-card overflow-hidden bg-white">
                    {/* クイズイベントヘッダー */}
                    <div className="p-5 bg-amber-100 border-b-[3px] border-gray-900 flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <span className="inline-block bg-white border-2 border-gray-900 px-2.5 py-0.5 rounded-md text-xs font-black mr-2">
                          コード: {h.code}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                          {h.title}
                        </h3>
                      </div>
                      <div>
                        {isEnded ? (
                          <span className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm font-black px-3 py-1.5 rounded-lg">
                            <PixelIcon name="flag" size={18} />
                            <span>回答終了（全結果公開中）</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-700 text-white text-sm font-black px-3 py-1.5 rounded-lg border-2 border-gray-900">
                            <PixelIcon name="clock" size={18} />
                            <span>開催中</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* スコアサマリー */}
                    <div className="p-5 bg-amber-50/60 border-b-[3px] border-gray-900 grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                      <div className="bg-white p-3 rounded-xl border-2 border-gray-900">
                        <p className="text-xs sm:text-sm font-black text-gray-600">回答した数</p>
                        <p className="text-xl sm:text-2xl font-black text-gray-900">
                          {h.answered_count || 0} <span className="text-base">/ {h.total_questions || (h.questions ? h.questions.length : 0)} 問</span>
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border-2 border-gray-900">
                        <p className="text-xs sm:text-sm font-black text-gray-600">現在の正解数</p>
                        <p className="text-xl sm:text-2xl font-black text-emerald-700">
                          {anyPendingAfterEnd ? '終了後に発表' : `${h.correct_count || 0} 問`}
                        </p>
                      </div>
                      <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-xl border-2 border-gray-900">
                        <p className="text-xs sm:text-sm font-black text-gray-600">合計ポイント</p>
                        <p className="text-2xl sm:text-3xl font-black text-blue-700">
                          {anyPendingAfterEnd ? '???' : h.total_score || 0} <span className="text-base">pt</span>
                        </p>
                      </div>
                    </div>

                    {/* 問題ごとの詳細リスト */}
                    <div className="p-5 space-y-4">
                      <h4 className="font-black text-lg text-gray-900 flex items-center gap-2">
                        <PixelIcon name="book" size={24} />
                        <span>問題ごとの結果と解説</span>
                      </h4>

                      {h.questions &&
                        h.questions.map((q, qIdx) => {
                          const hasAnswered = q.selected_index !== undefined && q.selected_index !== null && q.selected_index >= 0;

                          return (
                            <div
                              key={q.id || qIdx}
                              className="p-4 rounded-xl border-2 border-gray-900 bg-[#FFFDF7] space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="bg-gray-900 text-white font-black text-sm px-2.5 py-1 rounded">
                                    第 {qIdx + 1} 問
                                  </span>
                                  {q.code && (
                                    <span className="bg-amber-100 border border-gray-900 text-gray-900 font-mono font-bold text-xs px-2 py-0.5 rounded">
                                      コード: {q.code}
                                    </span>
                                  )}
                                </div>

                                {!hasAnswered ? (
                                  <span className="bg-gray-200 text-gray-800 font-black text-sm px-3 py-1 rounded-lg border border-gray-900">
                                    未回答
                                  </span>
                                ) : !q.can_view_detail ? (
                                  <span className="inline-flex items-center gap-1.5 bg-amber-200 text-gray-900 font-black text-sm px-3 py-1 rounded-lg border-2 border-gray-900">
                                    <PixelIcon name="lock" size={18} />
                                    <span>回答済み（終了後に結果発表！）</span>
                                  </span>
                                ) : q.is_correct ? (
                                  <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-800 font-black text-base px-3 py-1 rounded-lg border-2 border-red-700">
                                    <PixelIcon name="correct" size={20} />
                                    <span>せいかい！ (+{q.points_awarded ?? q.points} pt)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-900 font-black text-base px-3 py-1 rounded-lg border-2 border-blue-800">
                                    <PixelIcon name="wrong" size={20} />
                                    <span>ざんねん… ({q.points_awarded ?? 0} pt)</span>
                                  </span>
                                )}
                              </div>

                              <p className="text-base sm:text-lg font-black text-gray-900">
                                {q.text}
                              </p>

                              {hasAnswered && (
                                <p className="text-sm sm:text-base font-bold text-gray-800">
                                  あなたが選んだ答え：{' '}
                                  <span className="font-black underline">
                                    {['A', 'B', 'C', 'D'][q.selected_index] || ''}「
                                    {q.options && q.options[q.selected_index]
                                      ? q.options[q.selected_index]
                                      : '記録なし'}
                                    」
                                  </span>
                                </p>
                              )}

                              {q.can_view_detail ? (
                                <div className="pt-2 border-t-2 border-dashed border-gray-300 space-y-2">
                                  {q.correct_index >= 0 && q.options && (
                                    <p className="text-sm sm:text-base font-black text-emerald-800">
                                      正しい答え： {['A', 'B', 'C', 'D'][q.correct_index]}「
                                      {q.options[q.correct_index]}」
                                    </p>
                                  )}
                                  {q.explanation && (
                                    <div className="bg-white p-3 rounded-lg border-2 border-gray-900 text-sm sm:text-base text-gray-900">
                                      <span className="font-black text-blue-800 block mb-1">
                                        【かいせつ】
                                      </span>
                                      {q.explanation}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg bg-amber-100/70 border border-amber-500 text-sm font-bold text-gray-800">
                                  この問題は「クイズの制限時間が終わってから結果を見られる」設定になっています。終了まで楽しみにお待ちください！
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : !isRegistered ? (
          /* ==========================================
             1. 参加者エントリー画面（子ども・シニアにも優しい大きな入力欄）
             ========================================== */
          <form onSubmit={handleRegister} className="tactile-card p-6 sm:p-8 space-y-6 my-2">
            <div className="flex items-center gap-3 border-b-[3px] border-gray-900 pb-4">
              <PixelIcon name="user" size={42} />
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
                  さんか登録（エントリー）
                </h2>
                <p className="text-sm sm:text-base font-bold text-gray-700">
                  お名前を入れて、すぐクイズをはじめよう！
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-base sm:text-lg font-black text-gray-900 mb-2">
                  1. お名前（ニックネームでもOK！） <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="れい：たろう"
                  maxLength={16}
                  className="w-full bg-amber-50/50 border-[3px] border-gray-900 rounded-xl px-4 py-3.5 text-lg sm:text-xl font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-300"
                />
                <p className="text-xs sm:text-sm font-bold text-gray-600 mt-1">
                  ※16文字まで。記号は使えません。
                </p>
              </div>

              <div>
                <label className="block text-base sm:text-lg font-black text-gray-900 mb-2">
                  2. 学籍番号 または 受付番号（なければ空欄でOK）
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="れい：12345（空欄でも参加できます）"
                  className="w-full bg-amber-50/50 border-[3px] border-gray-900 rounded-xl px-4 py-3.5 text-lg sm:text-xl font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-300"
                />
              </div>

              <div className="bg-amber-50 p-4 sm:p-5 rounded-xl border-[3px] border-gray-900 space-y-4">
                <p className="text-gray-900 font-black text-base">
                  3. 参加するまえに、2つのルールにチェックを入れてください：
                </p>

                <label className="flex items-center gap-3 cursor-pointer p-2 bg-white rounded-lg border-2 border-gray-900">
                  <input
                    type="checkbox"
                    checked={tosAgreed}
                    onChange={(e) => setTosAgreed(e.target.checked)}
                    className="w-7 h-7 accent-blue-700 rounded cursor-pointer flex-shrink-0"
                  />
                  <span className="text-base sm:text-lg font-bold text-gray-900">
                    <button
                      type="button"
                      onClick={() => setActiveModal('pashatoku')}
                      className="text-blue-700 underline font-black hover:text-blue-900"
                    >
                      パシャトク利用規約
                    </button>{' '}
                    に同意します
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-2 bg-white rounded-lg border-2 border-gray-900">
                  <input
                    type="checkbox"
                    checked={hostTosAgreed}
                    onChange={(e) => setHostTosAgreed(e.target.checked)}
                    className="w-7 h-7 accent-emerald-700 rounded cursor-pointer flex-shrink-0"
                  />
                  <span className="text-base sm:text-lg font-bold text-gray-900">
                    <button
                      type="button"
                      onClick={() => setActiveModal('host')}
                      className="text-emerald-800 underline font-black hover:text-emerald-950"
                    >
                      イベントのお約束（主催者規約）
                    </button>{' '}
                    に同意します
                  </span>
                </label>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl border-[3px] border-red-700 bg-red-100 text-red-900 font-black text-base text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full tactile-btn bg-blue-700 hover:bg-blue-600 text-white py-4 px-6 font-black text-xl sm:text-2xl flex items-center justify-center gap-3"
            >
              <PixelIcon name="check" size={30} />
              <span>スタート！（参加する）</span>
            </button>

            <div className="pt-4 border-t-2 border-gray-200 text-center">
              <a
                href="/admin"
                className="inline-flex items-center gap-1.5 text-gray-600 text-sm font-bold hover:text-gray-900 underline"
              >
                <PixelIcon name="gear" size={18} />
                <span>スタッフ・管理者画面はこちら</span>
              </a>
            </div>
          </form>
        ) : !quizData ? (
          /* ==========================================
             2. QRコード読み取り ＆ 3桁コード入力画面
             ========================================== */
          <div className="space-y-6">
            {/* 参加者バッジ */}
            <div className="tactile-card p-4 bg-emerald-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <PixelIcon name="check" size={32} />
                <div>
                  <p className="text-xs font-black text-emerald-800">参加中のお名前</p>
                  <p className="text-lg sm:text-xl font-black text-gray-900">{name} さん</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetRegistration}
                className="text-sm font-black text-gray-700 underline hover:text-red-700 px-2 py-1"
              >
                お名前を変更する
              </button>
            </div>

            {error && (
              <div className="tactile-card p-4 border-red-700 bg-red-100 text-red-900 font-black text-base sm:text-lg text-center">
                {error}
              </div>
            )}

            {!quizCode ? (
              <div className="space-y-6">
                {/* 方法①：番号（コード）を直接入力する（カメラが苦手な方やシニア・子どもでも一番確実！） */}
                <div className="tactile-card p-5 sm:p-6 bg-white space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-200 p-2 rounded-xl border-2 border-gray-900">
                      <PixelIcon name="book" size={32} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                        方法①：クイズの番号（コード）を入れる
                      </h2>
                      <p className="text-sm sm:text-base font-bold text-gray-700">
                        教室に書いてある文字・数字を入れてボタンを押してください
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (manualCodeInput.trim()) {
                        startQuizByCode(manualCodeInput);
                      }
                    }}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <input
                      type="text"
                      value={manualCodeInput}
                      onChange={(e) => setManualCodeInput(e.target.value)}
                      placeholder="ここにコードを入力（例: demo1）"
                      className="flex-1 bg-amber-50 border-[3px] border-gray-900 rounded-xl px-4 py-3.5 text-xl font-mono font-black text-center text-gray-900 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!manualCodeInput.trim() || isLoadingQuiz}
                      className="tactile-btn bg-blue-700 hover:bg-blue-600 text-white px-8 py-4 font-black text-xl whitespace-nowrap"
                    >
                      {isLoadingQuiz ? 'よみこみ中...' : '問題をひらく！'}
                    </button>
                  </form>
                </div>

                {/* 方法②：カメラでQRコードを写す */}
                <div className="tactile-card p-5 sm:p-6 bg-white space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-xl border-2 border-gray-900">
                      <PixelIcon name="camera" size={32} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                        方法②：カメラでQRコードを読み取る
                      </h2>
                      <p className="text-sm sm:text-base font-bold text-gray-700">
                        下のカメラ枠に、教室のQRコードをうつしてください
                      </p>
                    </div>
                  </div>

                  <div id="reader" className="w-full"></div>
                </div>
              </div>
            ) : (
              /* QRスキャン直後・読み込み画面 */
              <div className="tactile-card p-8 text-center bg-amber-50 space-y-6">
                <div className="flex justify-center">
                  <PixelIcon name="camera" size={64} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
                  クイズを見つけました！
                </h2>
                <div className="bg-white border-[3px] border-gray-900 rounded-xl py-3 px-6 inline-block">
                  <span className="text-sm font-black text-gray-600 block">クイズコード</span>
                  <span className="text-2xl sm:text-3xl font-mono font-black text-blue-700">
                    {quizCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => startQuizByCode(quizCode)}
                  disabled={isLoadingQuiz}
                  className="w-full tactile-btn bg-blue-700 hover:bg-blue-600 text-white py-4 px-8 font-black text-2xl"
                >
                  {isLoadingQuiz ? 'よみこみ中...' : 'クイズをスタート！'}
                </button>
                <button
                  type="button"
                  onClick={resetToScanner}
                  className="tactile-btn bg-white hover:bg-gray-100 text-gray-900 py-3 px-6 font-black text-base"
                >
                  べつのQRコードを読み直す
                </button>
              </div>
            )}
          </div>
        ) : isFinished ? (
          /* ==========================================
             3. 1セット解き終わった後の完了画面
             ========================================== */
          <div className="tactile-card p-6 sm:p-8 text-center bg-amber-50 space-y-6 my-4">
            <div className="flex justify-center">
              <PixelIcon name="trophy" size={72} />
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">
                回答かんりょう！
              </h2>
              <p className="text-lg sm:text-xl font-black text-blue-800">{quizData.title}</p>
            </div>

            {effectiveDisplay === 'after_end' && quizData.play_status !== 'ended' ? (
              <div className="tactile-card p-6 bg-white space-y-3">
                <PixelIcon name="lock" size={44} />
                <p className="text-xl font-black text-gray-900">
                  あなたの回答をしっかり記録しました！
                </p>
                <p className="text-base font-bold text-gray-700">
                  このクイズは、制限時間が終わってから「けっか・履歴」画面で正解と得点が発表されます。楽しみにしていてくださいね！
                </p>
              </div>
            ) : (
              <div className="tactile-card p-6 bg-white">
                <p className="text-base sm:text-lg font-black text-gray-700 mb-1">
                  今回かくとくしたポイント
                </p>
                <p className="text-5xl sm:text-6xl font-black text-blue-700">
                  {score} <span className="text-2xl text-gray-900">pt</span>
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                type="button"
                onClick={resetToScanner}
                className="flex-1 tactile-btn bg-blue-700 hover:bg-blue-600 text-white py-4 px-6 font-black text-xl flex items-center justify-center gap-2"
              >
                <PixelIcon name="camera" size={26} />
                <span>つぎのQRコードを探す</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('history');
                  fetchHistory(userId);
                }}
                className="flex-1 tactile-btn bg-emerald-700 hover:bg-emerald-600 text-white py-4 px-6 font-black text-xl flex items-center justify-center gap-2"
              >
                <PixelIcon name="trophy" size={26} />
                <span>けっか・解説を見る</span>
              </button>
            </div>
          </div>
        ) : quizData.play_status === 'waiting' ? (
          /* ==========================================
             4. 開始前の待機画面（開始されたら自動で問題が開きます）
             ========================================== */
          <div className="tactile-card p-8 text-center bg-amber-50 space-y-5 my-4">
            <div className="flex justify-center">
              <PixelIcon name="clock" size={64} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
              はじまるのを待っています！
            </h2>
            <p className="text-xl font-black text-blue-800">{quizData.title}</p>
            <p className="text-base sm:text-lg font-bold text-gray-800 bg-white p-4 rounded-xl border-2 border-gray-900">
              スタッフが「開始」ボタンを押すと、自動的にクイズ画面に切り替わります。このまま少しだけお待ちください！
            </p>
            <button
              type="button"
              onClick={resetToScanner}
              className="tactile-btn bg-white hover:bg-gray-100 text-gray-900 py-3 px-6 font-black text-base"
            >
              もどる
            </button>
          </div>
        ) : quizData.play_status === 'ended' ? (
          /* ==========================================
             5. 終了済みイベント画面
             ========================================== */
          <div className="tactile-card p-8 text-center bg-white space-y-5 my-4">
            <div className="flex justify-center">
              <PixelIcon name="flag" size={64} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
              このクイズの回答時間は終了しました
            </h2>
            <p className="text-lg font-bold text-gray-700">{quizData.title}</p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setViewMode('history');
                  fetchHistory(userId);
                }}
                className="flex-1 tactile-btn bg-emerald-700 hover:bg-emerald-600 text-white py-4 px-6 font-black text-lg flex items-center justify-center gap-2"
              >
                <PixelIcon name="trophy" size={24} />
                <span>けっか・正解を見る</span>
              </button>
              <button
                type="button"
                onClick={resetToScanner}
                className="flex-1 tactile-btn bg-white hover:bg-gray-100 text-gray-900 py-4 px-6 font-black text-lg"
              >
                スキャン画面へもどる
              </button>
            </div>
          </div>
        ) : (
          /* ==========================================
             6. クイズ出題・回答プレイ画面
             ========================================== */
          <div className="space-y-5">
            {/* タイトルと問題番号バー */}
            <div className="tactile-card p-4 bg-amber-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetToScanner}
                  className="bg-white border-2 border-gray-900 px-3 py-1 rounded-lg font-black text-sm hover:bg-gray-100"
                >
                  ← もどる
                </button>
                <span className="font-black text-base sm:text-lg text-gray-900">
                  {quizData.title}
                </span>
              </div>
              <span className="bg-gray-900 text-white font-black text-base px-3.5 py-1 rounded-lg">
                だい {currentQIndex + 1} もん / 全 {quizData.questions.length} 問
              </span>
            </div>

            {error && (
              <div className="tactile-card p-4 border-red-700 bg-red-100 text-red-900 font-black text-base text-center">
                {error}
              </div>
            )}

            {/* GPSチェック中 */}
            {!gpsVerified ? (
              <div className="tactile-card p-8 text-center bg-white space-y-4">
                <div className="flex justify-center">
                  <PixelIcon name="pin" size={56} />
                </div>
                <h3 className="text-2xl font-black text-gray-900">場所（GPS）をチェック中</h3>
                <p className="text-lg font-bold text-gray-700">{gpsError}</p>
                {gpsError && (
                  <button
                    type="button"
                    onClick={() => {
                      setGpsVerified(false);
                      setGpsError('もう一度チェックしています...');
                      verifyGps(
                        quizData.questions[currentQIndex].lat,
                        quizData.questions[currentQIndex].lng,
                        quizData.questions[currentQIndex].radius || 50
                      )
                        .then(() => setGpsVerified(true))
                        .catch((e) => setGpsError(e));
                    }}
                    className="tactile-btn bg-blue-700 text-white px-8 py-3 font-black text-lg"
                  >
                    もう一度ためす
                  </button>
                )}
              </div>
            ) : quizData.questions[currentQIndex] &&
              answeredQuestionIds.some(
                (id) => String(id) === String(quizData.questions[currentQIndex].id)
              ) &&
              !showAnswer ? (
              /* すでに回答済みの問題を開いた場合 */
              <div className="tactile-card p-8 text-center bg-white space-y-5">
                <div className="flex justify-center">
                  <PixelIcon name="check" size={64} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-emerald-800">
                  この問題はすでに回答ずみです！
                </h2>
                <p className="text-base sm:text-lg font-bold text-gray-700">
                  教室にある別のQRコードを探すか、「けっか・履歴」からこれまでの記録を見てみましょう！
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  {currentQIndex < quizData.questions.length - 1 && (
                    <button
                      type="button"
                      onClick={nextQuestion}
                      className="flex-1 tactile-btn bg-blue-700 text-white py-4 px-6 font-black text-lg"
                    >
                      つぎの問題へすすむ
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetToScanner}
                    className="flex-1 tactile-btn bg-amber-400 text-gray-900 py-4 px-6 font-black text-lg flex items-center justify-center gap-2"
                  >
                    <PixelIcon name="camera" size={24} />
                    <span>別のQRコードを読み取る</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('history');
                      fetchHistory(userId);
                    }}
                    className="flex-1 tactile-btn bg-emerald-700 text-white py-4 px-6 font-black text-lg flex items-center justify-center gap-2"
                  >
                    <PixelIcon name="trophy" size={24} />
                    <span>けっかを見る</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 問題文カード */}
                <div className="tactile-card p-5 sm:p-6 bg-white space-y-4">
                  {quizData.style === 'fastest' && (
                    <div className="bg-red-600 text-white px-4 py-2 rounded-xl border-2 border-gray-900 font-black text-sm sm:text-base flex items-center justify-center gap-2">
                      <PixelIcon name="bolt" size={22} />
                      <span>早押しモード！いちばん早く正解した人がポイントゲット！</span>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-900 border-2 border-gray-900 text-sm sm:text-base font-black px-3.5 py-1 rounded-lg">
                      もらえる得点: {quizData.questions[currentQIndex].points} ポイント
                    </span>
                    {quizData.questions[currentQIndex].penalty_points > 0 && (
                      <span className="bg-red-100 text-red-900 border-2 border-gray-900 text-sm sm:text-base font-black px-3.5 py-1 rounded-lg">
                        まちがえると: -{quizData.questions[currentQIndex].penalty_points} ポイント
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-relaxed py-2">
                    {quizData.questions[currentQIndex].text}
                  </h2>

                  {quizData.questions[currentQIndex].media_url && (
                    <img
                      src={quizData.questions[currentQIndex].media_url}
                      alt="問題イラスト"
                      className="w-full h-auto rounded-xl border-[3px] border-gray-900"
                    />
                  )}

                  {/* ヒントボタン */}
                  {quizData.questions[currentQIndex].hint && !showAnswer && !isLocked && (
                    <div className="pt-2">
                      {!hintUsed ? (
                        <button
                          type="button"
                          onClick={() => setHintUsed(true)}
                          className="w-full tactile-btn bg-amber-200 hover:bg-amber-300 text-gray-900 py-3 px-4 font-black text-base sm:text-lg flex items-center justify-center gap-2"
                        >
                          <PixelIcon name="bulb" size={26} />
                          <span>ヒントを見る（もらえる得点が半分になります）</span>
                        </button>
                      ) : (
                        <div className="bg-amber-100 border-[3px] border-gray-900 p-4 rounded-xl text-gray-900 text-base sm:text-lg font-black flex items-start gap-3">
                          <PixelIcon name="bulb" size={28} />
                          <div>
                            <span className="block text-sm text-amber-900">【ヒント】</span>
                            {quizData.questions[currentQIndex].hint}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 早押しロック時 */}
                {isLocked ? (
                  <div className="tactile-card p-6 sm:p-8 bg-red-50 text-center space-y-4">
                    <div className="flex justify-center">
                      <PixelIcon name="lock" size={56} />
                    </div>
                    <h3 className="text-2xl font-black text-red-800">ざんねん！ロックされました</h3>
                    <p className="text-lg font-bold text-gray-800">{lockMessage}</p>
                    <button
                      type="button"
                      onClick={nextQuestion}
                      className="w-full tactile-btn bg-blue-700 text-white py-4 px-8 font-black text-xl"
                    >
                      つぎへすすむ
                    </button>
                  </div>
                ) : (
                  /* 4択の大きなボタン */
                  <div className="space-y-3.5">
                    <p className="text-base font-black text-gray-700 px-1">
                      ↓ 正しいと思うボタンを1つ押してください：
                    </p>
                    {quizData.questions[currentQIndex].options.map((opt, i) => {
                      const isSelected = i === selectedOption;
                      const styleInfo = optionStyles[i] || optionStyles[0];

                      let cardClass =
                        'w-full tactile-btn text-left p-4 sm:p-5 font-black text-lg sm:text-xl flex items-center gap-4 ';

                      if (!showAnswer) {
                        cardClass += `bg-white text-gray-900 ${styleInfo.hoverBg}`;
                      } else if (effectiveDisplay === 'after_end') {
                        if (isSelected) {
                          cardClass += 'bg-amber-200 text-gray-900 ring-4 ring-amber-400';
                        } else {
                          cardClass += 'bg-gray-100 text-gray-500 opacity-75';
                        }
                      } else {
                        // Immediate result display
                        if (isSelected) {
                          cardClass += isCorrect
                            ? 'bg-red-100 text-red-950 ring-4 ring-red-500'
                            : 'bg-blue-100 text-blue-950 ring-4 ring-blue-500';
                        } else if (i === correctIndex) {
                          cardClass += 'bg-emerald-100 text-emerald-950 ring-4 ring-emerald-500';
                        } else {
                          cardClass += 'bg-gray-100 text-gray-500 opacity-70';
                        }
                      }

                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={showAnswer}
                          onClick={() => handleOptionSelect(i)}
                          className={cardClass}
                        >
                          <span
                            className={`w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center rounded-xl border-2 border-gray-900 text-xl sm:text-2xl font-black ${styleInfo.badgeBg}`}
                          >
                            {styleInfo.label}
                          </span>
                          <span className="flex-1 break-words leading-snug">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 回答直後のフィードバック表示（即表示モード or 終了後発表モード） */}
                {showAnswer && !isLocked && (
                  <div className="tactile-card p-6 bg-white space-y-5">
                    {effectiveDisplay === 'after_end' ? (
                      <div className="text-center space-y-3 bg-amber-50 p-5 rounded-xl border-2 border-gray-900">
                        <div className="flex justify-center">
                          <PixelIcon name="check" size={52} />
                        </div>
                        <p className="text-2xl font-black text-gray-900">
                          回答を受け付けました！
                        </p>
                        <p className="text-base sm:text-lg font-bold text-gray-800">
                          あなたが選んだ答え：{' '}
                          <span className="font-black underline">
                            {['A', 'B', 'C', 'D'][selectedOption]}「
                            {quizData.questions[currentQIndex].options[selectedOption]}」
                          </span>
                        </p>
                        <p className="text-sm sm:text-base font-bold text-amber-900 bg-amber-200/70 p-3 rounded-lg border border-gray-900">
                          この問題は「クイズの制限時間が終わってから正解・解説が見られる」設定になっています。終了後に「けっか・履歴」ボタンを押して確認してね！
                        </p>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`p-5 rounded-xl border-[3px] border-gray-900 text-center space-y-2 ${
                            isCorrect ? 'bg-red-50' : 'bg-blue-50'
                          }`}
                        >
                          <div className="flex justify-center">
                            <PixelIcon name={isCorrect ? 'correct' : 'wrong'} size={56} />
                          </div>
                          <p
                            className={`text-3xl font-black ${
                              isCorrect ? 'text-red-700' : 'text-blue-800'
                            }`}
                          >
                            {isCorrect ? 'やったね！せいかい！' : 'おしい！ざんねん…'}
                          </p>
                          <p className="text-lg font-black text-gray-900">
                            かくとくポイント：{' '}
                            <span
                              className={
                                awardedPoints > 0 ? 'text-emerald-700 text-2xl' : 'text-red-700 text-2xl'
                              }
                            >
                              {awardedPoints > 0 ? `+${awardedPoints}` : awardedPoints} pt
                            </span>
                          </p>
                          {!isCorrect &&
                            correctIndex >= 0 &&
                            quizData.questions[currentQIndex].options[correctIndex] && (
                              <p className="text-base sm:text-lg font-black text-emerald-800 pt-1">
                                正しい答え： {['A', 'B', 'C', 'D'][correctIndex]}「
                                {quizData.questions[currentQIndex].options[correctIndex]}」
                              </p>
                            )}
                        </div>

                        {explanation && (
                          <div className="bg-amber-50 p-4 sm:p-5 rounded-xl border-2 border-gray-900 space-y-1.5">
                            <div className="flex items-center gap-2 font-black text-blue-800 text-base sm:text-lg">
                              <PixelIcon name="book" size={24} />
                              <span>【かいせつ】</span>
                            </div>
                            <p className="text-base sm:text-lg font-bold text-gray-900 leading-relaxed">
                              {explanation}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={nextQuestion}
                      className="w-full tactile-btn bg-blue-700 hover:bg-blue-600 text-white py-4 px-8 font-black text-xl sm:text-2xl"
                    >
                      {currentQIndex < quizData.questions.length - 1
                        ? 'つぎの問題へすすむ →'
                        : 'さいごの結果画面へ →'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

import { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import PixelIcon from './PixelIcon';

function QuizCreator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [title, setTitle] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [mode, setMode] = useState('normal');
  const [style, setStyle] = useState('free');
  const [resultDisplay, setResultDisplay] = useState('immediate'); // 'immediate' or 'after_end'

  const [timerDays, setTimerDays] = useState(0);
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const [questions, setQuestions] = useState([
    {
      code: '',
      text: '',
      options: ['', '', '', ''],
      correct_index: 0,
      points: 1,
      question_type: 'radio',
      media_url: '',
      hint: '',
      penalty_points: 0,
      explanation: '',
      lat: '',
      lng: '',
      radius: 50,
      result_display: 'inherit', // 'inherit', 'immediate', 'after_end'
    },
  ]);

  const [createdCode, setCreatedCode] = useState(null);
  const [createdQuiz, setCreatedQuiz] = useState(null);
  const [printStyle, setPrintStyle] = useState('detailed');
  const [error, setError] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('id');
  const editCode = urlParams.get('code');
  const isEditMode = Boolean(editId && editCode);

  useEffect(() => {
    if (isAuthenticated && isEditMode) {
      axios
        .get(`/api/admin/quizzes/${editId}`)
        .then((res) => {
          const qz = res.data;
          setTitle(qz.title);
          setCustomCode(qz.code);
          setMode(qz.mode);
          setStyle(qz.style);
          setResultDisplay(qz.result_display || 'immediate');
          if (qz.timer_duration_sec) {
            const d = Math.floor(qz.timer_duration_sec / 86400);
            const h = Math.floor((qz.timer_duration_sec % 86400) / 3600);
            const m = Math.floor((qz.timer_duration_sec % 3600) / 60);
            const s = qz.timer_duration_sec % 60;
            setTimerDays(d);
            setTimerHours(h);
            setTimerMinutes(m);
            setTimerSeconds(s);
          }
          if (qz.questions && qz.questions.length > 0) {
            setQuestions(
              qz.questions.map((q) => ({
                ...q,
                options: q.options || ['', '', '', ''],
                lat: q.lat || '',
                lng: q.lng || '',
                radius: q.radius || 50,
                result_display: q.result_display || 'inherit',
              }))
            );
          }
        })
        .catch(() => {
          setError('編集するクイズの取得に失敗しました。');
        });
    }
  }, [isAuthenticated, isEditMode, editId, editCode]);

  const handleLogin = (e) => {
    e.preventDefault();
    const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || '80558055';
    if (password === adminPass) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('パスワードが間違っています。');
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        code: '',
        text: '',
        options: ['', '', '', ''],
        correct_index: 0,
        points: 1,
        question_type: 'radio',
        media_url: '',
        hint: '',
        penalty_points: 0,
        explanation: '',
        lat: '',
        lng: '',
        radius: 50,
        result_display: 'inherit',
      },
    ]);
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter((line) => line.trim() !== '');

      const newQuestions = [];
      let startIndex = 0;
      if (lines[0] && lines[0].startsWith('作者')) {
        startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        let ret = [];
        let state = 0;
        let value = '';
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
          let ch = line[j];
          if (state === 0) {
            if (ch === '"') {
              state = 1;
            } else if (ch === ',') {
              ret.push(value);
              value = '';
            } else {
              value += ch;
            }
          } else if (state === 1) {
            if (ch === '"') {
              if (j + 1 < line.length && line[j + 1] === '"') {
                value += '"';
                j++;
              } else {
                state = 0;
              }
            } else {
              value += ch;
            }
          }
        }
        ret.push(value);

        if (ret.length < 8) continue;

        const [, qText, opt1, opt2, opt3, opt4, correctNum, pointsStr, explanationStr] = ret;

        const options = [opt1 || '', opt2 || '', opt3 || '', opt4 || ''];
        const correct_index = Math.max(0, parseInt(correctNum, 10) - 1);
        const points = parseInt(pointsStr, 10) || 1;
        const explanation = explanationStr || '';

        newQuestions.push({
          code: '',
          text: qText || '',
          options: options,
          correct_index: correct_index,
          points: points,
          question_type: 'radio',
          media_url: '',
          hint: '',
          penalty_points: 0,
          explanation: explanation,
          lat: '',
          lng: '',
          radius: 50,
          result_display: 'inherit',
        });
      }

      if (newQuestions.length > 0) {
        setQuestions((prev) => [...prev, ...newQuestions]);
        e.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const removeQuestion = (index) => {
    if (questions.length === 1) return;
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const generateRandomCode = (index) => {
    const charset = 'abcdefghijkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 3; i++) {
      code += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    updateQuestion(index, 'code', code);
  };

  const handlePrint = (style) => {
    setPrintStyle(style);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title) {
      setError('クイズのタイトルを入力してください。');
      return;
    }
    for (let q of questions) {
      if (!q.text) {
        setError('問題文が未入力の箇所があります。');
        return;
      }
      if (q.question_type === 'radio') {
        for (let opt of q.options) {
          if (!opt) {
            setError('選択肢が未入力の箇所があります。');
            return;
          }
        }
      }
    }

    try {
      let timerDurationSec = null;
      const totalSec =
        (parseInt(timerDays, 10) || 0) * 86400 +
        (parseInt(timerHours, 10) || 0) * 3600 +
        (parseInt(timerMinutes, 10) || 0) * 60 +
        (parseInt(timerSeconds, 10) || 0);
      if (totalSec > 0) {
        timerDurationSec = Math.min(totalSec, 8035200);
      }

      const payload = {
        title,
        mode,
        style,
        result_display: resultDisplay,
        timer_duration_sec: timerDurationSec,
        questions: questions.map((q) => {
          const formattedQ = {
            ...q,
            correct_index: Number(q.correct_index),
            points: Number(q.points),
            penalty_points: Number(q.penalty_points),
            radius: Number(q.radius),
            result_display: q.result_display || 'inherit',
          };
          if (mode === 'gps' && q.lat && q.lng) {
            formattedQ.lat = parseFloat(q.lat);
            formattedQ.lng = parseFloat(q.lng);
          } else {
            formattedQ.lat = null;
            formattedQ.lng = null;
          }
          return formattedQ;
        }),
      };

      if (customCode.trim() !== '') {
        payload.code = customCode.trim();
      }

      if (isEditMode) {
        const res = await axios.put(`/api/admin/quizzes/${editId}`, payload);
        setCreatedCode(res.data.code);
        setCreatedQuiz(res.data);
      } else {
        const res = await axios.post(`/api/quizzes`, payload);
        setCreatedCode(res.data.code);
        setCreatedQuiz(res.data);
      }
    } catch (err) {
      if (err.response && err.response.status === 409) {
        setError('指定したクイズコードはすでに使用されています。別のコードを指定してください。');
      } else {
        setError(`クイズの${isEditMode ? '更新' : '作成'}に失敗しました。`);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[100dvh] bg-[#FFFDF7] text-gray-900 flex flex-col items-center justify-center p-6">
        <form onSubmit={handleLogin} className="tactile-card p-8 w-full max-w-md bg-white space-y-6">
          <div className="flex items-center justify-center gap-3">
            <PixelIcon name="gear" size={40} />
            <h2 className="text-2xl font-black text-gray-900">管理者ログイン</h2>
          </div>
          <div>
            <label className="block text-base font-black text-gray-800 mb-2">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-amber-50 border-[3px] border-gray-900 rounded-xl px-4 py-3 text-lg font-bold outline-none"
              placeholder="パスワードを入力"
            />
          </div>
          {authError && <p className="text-red-700 font-black text-center">{authError}</p>}
          <button
            type="submit"
            className="w-full tactile-btn bg-blue-700 hover:bg-blue-600 text-white py-3.5 font-black text-lg"
          >
            ログインする
          </button>
        </form>
      </div>
    );
  }

  if (createdCode) {
    const quizUrl = `${window.location.origin}/?code=${createdCode}`;
    const isSpotMode = createdQuiz && createdQuiz.mode === 'spot';

    return (
      <div className="min-h-[100dvh] bg-[#FFFDF7] text-gray-900 flex flex-col items-center justify-center p-6 print:bg-white print:text-black print:p-0">
        <div className="tactile-card p-8 text-center max-w-lg w-full bg-white space-y-6 print:hidden">
          <div className="flex justify-center">
            <PixelIcon name="check" size={56} />
          </div>
          <h2 className="text-3xl font-black text-emerald-800">保存が完了しました！</h2>

          {!isSpotMode ? (
            <>
              <div className="bg-white p-6 rounded-2xl border-[3px] border-gray-900 inline-block">
                <QRCodeSVG value={quizUrl} size={200} />
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border-2 border-gray-900">
                <p className="text-sm text-gray-700 mb-1 font-black">クイズコード</p>
                <p className="text-3xl font-mono font-black tracking-widest text-blue-800">
                  {createdCode}
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-base text-gray-800 font-black">
                展示スポット用の問題コード一覧（パシャトクモード）
              </p>
              <div className="max-h-72 overflow-y-auto bg-amber-50 p-4 rounded-xl border-2 border-gray-900 space-y-3">
                {createdQuiz.questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="bg-white p-3 rounded-xl flex items-center justify-between border-2 border-gray-900 text-left"
                  >
                    <div>
                      <p className="text-xs text-gray-700 font-black mb-1">
                        第{idx + 1}問: {q.text.substring(0, 18)}...
                      </p>
                      <p className="text-xl font-mono font-black tracking-widest text-blue-800">
                        コード: {q.code}
                      </p>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-gray-900">
                      <QRCodeSVG value={`${window.location.origin}/?code=${q.code}`} size={64} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handlePrint('detailed')}
                  className="flex-1 tactile-btn bg-blue-700 text-white py-3.5 font-black flex items-center justify-center gap-2"
                >
                  <PixelIcon name="print" size={22} />
                  <span>印刷（問題文つき）</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrint('simple')}
                  className="flex-1 tactile-btn bg-amber-400 text-gray-900 py-3.5 font-black flex items-center justify-center gap-2"
                >
                  <PixelIcon name="print" size={22} />
                  <span>印刷（QRとコードのみ）</span>
                </button>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 tactile-btn bg-emerald-700 text-white py-3.5 font-black"
            >
              続けて作成する
            </button>
            <a
              href="/admin"
              className="flex-1 tactile-btn bg-white text-gray-900 py-3.5 font-black flex items-center justify-center"
            >
              管理ダッシュボードへ
            </a>
          </div>
        </div>

        {/* 印刷用レイアウト */}
        {isSpotMode && printStyle === 'detailed' && (
          <div className="hidden print:block w-full">
            {createdQuiz.questions.map((q, idx) => (
              <div
                key={`print-${q.id || idx}`}
                className="break-after-page flex flex-col items-center justify-center min-h-screen w-full bg-white text-black p-10 print:h-screen"
              >
                <h1 className="text-5xl font-black mb-8 text-center">{createdQuiz.title}</h1>
                <h2 className="text-3xl font-bold mb-12 text-center">
                  第{idx + 1}問: {q.text}
                </h2>
                <QRCodeSVG value={`${window.location.origin}/?code=${q.code}`} size={440} />
                <p className="text-4xl font-black tracking-widest mt-12 font-mono bg-gray-100 px-8 py-4 rounded-2xl border-4 border-black">
                  コード: {q.code}
                </p>
                <p className="text-2xl mt-8 text-black font-black">パシャトク (PASHATOKU)</p>
              </div>
            ))}
          </div>
        )}

        {isSpotMode && printStyle === 'simple' && (
          <div className="hidden print:block w-full">
            {createdQuiz.questions.map((q, idx) => (
              <div
                key={`print-${q.id || idx}`}
                className="break-after-page flex flex-col items-center justify-center min-h-screen w-full bg-white text-black p-10 print:h-screen"
              >
                <QRCodeSVG value={`${window.location.origin}/?code=${q.code}`} size={560} />
                <p className="text-5xl font-black tracking-widest mt-10 font-mono border-4 border-black px-8 py-3 rounded-xl">
                  {q.code}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFFDF7] text-gray-900 p-4 sm:p-6 pb-safe-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="tactile-card p-5 bg-amber-100 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <PixelIcon name="gear" size={38} />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
                {isEditMode ? 'クイズイベントの編集' : '新しいクイズイベントの作成'}
              </h1>
              <p className="text-sm font-bold text-gray-700">
                問題・制限時間・結果発表タイミングを設定できます
              </p>
            </div>
          </div>
          <a
            href="/admin"
            className="tactile-btn bg-white hover:bg-gray-100 text-gray-900 font-black px-4 py-2 text-base"
          >
            ← ダッシュボードへ戻る
          </a>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 1. 基本設定 */}
          <div className="tactile-card p-6 sm:p-8 bg-white space-y-6">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 border-b-[3px] border-gray-900 pb-2">
              1. クイズブロック（イベント）の基本設定
            </h2>

            <div>
              <label className="block text-base font-black text-gray-900 mb-2">
                クイズタイトル <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：酒造研究室 展示コラボクイズ"
                className="w-full bg-amber-50/60 border-[3px] border-gray-900 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-black text-gray-800 mb-2">出題モード</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-amber-50 border-[3px] border-gray-900 rounded-xl px-3 py-3 text-gray-900 font-black"
                >
                  <option value="normal">一括出題（通常モード）</option>
                  <option value="spot">教室展示スポット回収（パシャトク）</option>
                  <option value="gps">位置情報チェック付き（GPS）</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-800 mb-2">プレイスタイル</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full bg-amber-50 border-[3px] border-gray-900 rounded-xl px-3 py-3 text-gray-900 font-black"
                >
                  <option value="free">誰でも回答OK（通常）</option>
                  <option value="time_attack">タイムアタック</option>
                  <option value="fastest">早押し（最初の正解者でロック）</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-blue-900 mb-2">
                  結果・解説の公開タイミング（全体設定）
                </label>
                <select
                  value={resultDisplay}
                  onChange={(e) => setResultDisplay(e.target.value)}
                  className="w-full bg-blue-50 border-[3px] border-gray-900 rounded-xl px-3 py-3 text-gray-900 font-black"
                >
                  <option value="immediate">解いたらすぐ正解・解説を表示</option>
                  <option value="after_end">クイズ回答時間の終了後に結果・解説を公開</option>
                </select>
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border-2 border-gray-900">
              <label className="block text-base font-black text-gray-900 mb-2">
                このクイズの回答制限時間（タイマー設定）
              </label>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <input
                    type="number"
                    min="0"
                    max="93"
                    value={timerDays}
                    onChange={(e) => setTimerDays(e.target.value)}
                    className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-center font-black text-lg"
                  />
                  <span className="block text-center text-xs font-bold text-gray-700 mt-1">日</span>
                </div>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={timerHours}
                    onChange={(e) => setTimerHours(e.target.value)}
                    className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-center font-black text-lg"
                  />
                  <span className="block text-center text-xs font-bold text-gray-700 mt-1">時間</span>
                </div>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(e.target.value)}
                    className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-center font-black text-lg"
                  />
                  <span className="block text-center text-xs font-bold text-gray-700 mt-1">分</span>
                </div>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(e.target.value)}
                    className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-center font-black text-lg"
                  />
                  <span className="block text-center text-xs font-bold text-gray-700 mt-1">秒</span>
                </div>
              </div>
              <p className="text-xs font-bold text-gray-700 mt-2">
                ※すべて0の場合は時間無制限になります。管理画面で「開始」を押した瞬間からカウントダウンが始まり、時間切れになると自動で「終了」に切り替わります。
              </p>
            </div>

            <div>
              <label className="block text-sm font-black text-gray-800 mb-1">
                クイズブロックのコード（任意・3桁などの短い文字も指定可能）
              </label>
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="空欄の場合は自動で短いコードが生成されます（例: lab01）"
                disabled={isEditMode}
                className="w-full bg-amber-50/60 border-[3px] border-gray-900 rounded-xl px-4 py-2.5 font-mono font-bold disabled:opacity-50"
              />
            </div>
          </div>

          {/* 2. 各問題の設定 */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900 px-1">2. 各問題（クイズコード）の作成</h2>
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="tactile-card p-6 sm:p-8 bg-white space-y-5">
                <div className="flex justify-between items-center border-b-[3px] border-gray-900 pb-3">
                  <h3 className="text-xl font-black text-blue-800">第 {qIndex + 1} 問</h3>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="bg-red-100 hover:bg-red-200 text-red-800 border-2 border-gray-900 text-sm font-black px-3 py-1 rounded-lg"
                    >
                      この問題を削除
                    </button>
                  )}
                </div>

                {/* 問題ごとのコードと結果表示設定 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50 p-4 rounded-xl border-2 border-gray-900">
                  <div>
                    <label className="block text-xs font-black text-gray-800 mb-1">
                      この問題の個別コード（3桁など・空欄で自動生成）
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={q.code}
                        onChange={(e) => updateQuestion(qIndex, 'code', e.target.value)}
                        maxLength={10}
                        placeholder="自動生成（例: a7k）"
                        className="flex-1 bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-sm font-mono font-black"
                      />
                      <button
                        type="button"
                        onClick={() => generateRandomCode(qIndex)}
                        className="bg-white hover:bg-gray-100 border-2 border-gray-900 px-3 py-2 rounded-lg text-xs font-black"
                      >
                        3桁生成
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-blue-900 mb-1">
                      この問題の結果・解説表示タイミング
                    </label>
                    <select
                      value={q.result_display || 'inherit'}
                      onChange={(e) => updateQuestion(qIndex, 'result_display', e.target.value)}
                      className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-sm font-black text-gray-900"
                    >
                      <option value="inherit">クイズ全体の設定に従う</option>
                      <option value="immediate">この問題は解いたら即、正解・解説を表示</option>
                      <option value="after_end">この問題は回答時間の終了後に結果・解説を表示</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-900 mb-1">
                    問題文 <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={q.text}
                    onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                    placeholder="問題文を入力してください..."
                    rows={3}
                    className="w-full bg-amber-50/50 border-[3px] border-gray-900 rounded-xl px-4 py-3 font-bold text-base outline-none focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-800 mb-1">
                      画像URL（任意）
                    </label>
                    <input
                      type="text"
                      value={q.media_url}
                      onChange={(e) => updateQuestion(qIndex, 'media_url', e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-amber-50/50 border-2 border-gray-900 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-800 mb-1">
                      ヒント（任意・使うと得点半分）
                    </label>
                    <input
                      type="text"
                      value={q.hint}
                      onChange={(e) => updateQuestion(qIndex, 'hint', e.target.value)}
                      placeholder="展示パネルの右側を見てみよう！"
                      className="w-full bg-amber-50/50 border-2 border-gray-900 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-gray-100 p-4 rounded-xl border-2 border-gray-900">
                  <div>
                    <label className="block text-xs font-black text-emerald-800 mb-1">配点 (pt)</label>
                    <input
                      type="number"
                      value={q.points}
                      onChange={(e) => updateQuestion(qIndex, 'points', e.target.value)}
                      className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-center font-black"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-red-800 mb-1">お手つき減点</label>
                    <input
                      type="number"
                      value={q.penalty_points}
                      onChange={(e) => updateQuestion(qIndex, 'penalty_points', e.target.value)}
                      className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-center font-black"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-800 mb-1">形式</label>
                    <select
                      value={q.question_type}
                      onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
                      className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 font-black"
                    >
                      <option value="radio">4択クイズ</option>
                    </select>
                  </div>
                </div>

                {mode === 'gps' && (
                  <div className="bg-blue-50 p-4 rounded-xl border-2 border-gray-900">
                    <p className="text-xs text-blue-900 font-black mb-3">位置情報設定（GPSモード）</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">緯度</label>
                        <input
                          type="text"
                          value={q.lat}
                          onChange={(e) => updateQuestion(qIndex, 'lat', e.target.value)}
                          placeholder="35.6812"
                          className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">経度</label>
                        <input
                          type="text"
                          value={q.lng}
                          onChange={(e) => updateQuestion(qIndex, 'lng', e.target.value)}
                          placeholder="139.7671"
                          className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">半径(m)</label>
                        <input
                          type="number"
                          value={q.radius}
                          onChange={(e) => updateQuestion(qIndex, 'radius', e.target.value)}
                          className="w-full bg-white border-2 border-gray-900 rounded-lg px-3 py-2 text-sm text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-black text-gray-900 mb-2">
                    4つの選択肢（正解の丸ボタンを押して選択してください） <span className="text-red-600">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.options.map((opt, oIndex) => (
                      <div
                        key={oIndex}
                        className={`flex items-center gap-3 p-3 rounded-xl border-[3px] ${
                          q.correct_index === oIndex
                            ? 'bg-emerald-100 border-emerald-800'
                            : 'bg-amber-50/40 border-gray-900'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`correct-${qIndex}`}
                          checked={q.correct_index === oIndex}
                          onChange={() => updateQuestion(qIndex, 'correct_index', oIndex)}
                          className="w-6 h-6 accent-emerald-700 cursor-pointer"
                        />
                        <span className="font-black text-base text-gray-900">
                          {['A', 'B', 'C', 'D'][oIndex]}.
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                          placeholder={`選択肢 ${['A', 'B', 'C', 'D'][oIndex]}`}
                          className="flex-1 bg-white border-2 border-gray-900 rounded-lg px-3 py-2 font-bold text-gray-900 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-900 mb-1">
                    解説文（結果画面で表示されます）
                  </label>
                  <textarea
                    value={q.explanation}
                    onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                    placeholder="正解の理由や展示の補足説明などを入力..."
                    rows={2}
                    className="w-full bg-amber-50/50 border-2 border-gray-900 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={addQuestion}
              className="tactile-btn bg-amber-200 hover:bg-amber-300 text-gray-900 py-5 font-black text-lg"
            >
              ＋ 新しい問題を追加する
            </button>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <button
                type="button"
                className="w-full h-full tactile-btn bg-white hover:bg-gray-100 text-gray-900 py-5 font-black text-lg flex items-center justify-center gap-2"
              >
                <PixelIcon name="book" size={24} />
                <span>CSVファイルから問題を一括追加</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="tactile-card p-4 border-red-700 bg-red-100 text-red-900 text-center font-black">
              {error}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              className="w-full tactile-btn bg-emerald-700 hover:bg-emerald-600 text-white py-5 font-black text-2xl flex items-center justify-center gap-3"
            >
              <PixelIcon name="check" size={30} />
              <span>保存してクイズを{isEditMode ? '更新' : '作成'}する</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuizCreator;

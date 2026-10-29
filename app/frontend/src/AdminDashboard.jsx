import { useState, useEffect } from 'react';
import axios from 'axios';
import PixelIcon from './PixelIcon';

function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  const [sortField, setSortField] = useState('total_score');
  const [sortOrder, setSortOrder] = useState('desc');

  const [globalTimerEndAt, setGlobalTimerEndAt] = useState(null);
  const [globalTimerDays, setGlobalTimerDays] = useState(0);
  const [globalTimerHours, setGlobalTimerHours] = useState(0);
  const [globalTimerMinutes, setGlobalTimerMinutes] = useState(0);
  const [globalTimerSeconds, setGlobalTimerSeconds] = useState(0);

  const fetchGlobalTimer = async () => {
    try {
      const res = await axios.get(`/api/global_timer`);
      setGlobalTimerEndAt(res.data.end_at);
    } catch (e) {}
  };

  const updateGlobalTimer = async (sec) => {
    try {
      const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || '80558055';
      await axios.post(
        `/api/admin/global_timer`,
        { duration_sec: sec },
        {
          headers: { Authorization: `Bearer ${adminPass}` },
        }
      );
      fetchGlobalTimer();
    } catch (e) {}
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchQuizzes();
      fetchGlobalTimer();
    }
    const int = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(int);
  }, [isAuthenticated]);

  const fetchQuizzes = async () => {
    try {
      const res = await axios.get(`/api/admin/quizzes`);
      setQuizzes(res.data || []);
    } catch (err) {}
  };

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

  const updateQuizStatus = async (id, field, value) => {
    try {
      await axios.patch(`/api/admin/quizzes/${id}/status`, { [field]: value });
      fetchQuizzes();
    } catch (err) {}
  };

  const viewResults = async (quiz) => {
    setSelectedQuiz(quiz);
    setLoading(true);
    try {
      const res = await axios.get(`/api/admin/quizzes/${quiz.id}/results`);
      setResults(res.data || []);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

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
          <div className="text-center pt-2">
            <a href="/" className="text-sm font-black text-gray-700 underline">
              ← 参加者用トップ画面へもどる
            </a>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFFDF7] text-gray-900 p-4 sm:p-6 pb-safe-screen">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6">
        {/* 左カラム：全体タイマー＆イベント一覧 */}
        <div className="w-full xl:w-5/12 flex flex-col gap-6">
          <div className="tactile-card p-5 bg-amber-100 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <PixelIcon name="gear" size={38} />
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900">管理ダッシュボード</h1>
                <p className="text-sm font-bold text-gray-700">イベント進行・公開設定・成績確認</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="/"
                className="tactile-btn bg-white hover:bg-gray-100 text-gray-900 px-3 py-2 font-black text-sm"
              >
                参加者画面
              </a>
              <a
                href="/admin/create"
                className="tactile-btn bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 font-black text-sm"
              >
                ＋ 新規クイズ作成
              </a>
            </div>
          </div>

          {/* 全体タイマー設定カード */}
          <div className="tactile-card p-5 bg-red-50 space-y-4">
            <div className="flex items-center gap-2">
              <PixelIcon name="globe" size={28} />
              <h2 className="text-lg sm:text-xl font-black text-red-900">
                サービス全体強制タイマー
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-bold text-gray-800">
              設定した時間がゼロになると、全参加者の画面が「終了しました」に切り替わり、すべての結果・解説が閲覧可能になります。
            </p>
            {globalTimerEndAt && (
              <div className="bg-white p-3 rounded-xl border-2 border-gray-900 text-center">
                <p className="text-xs font-black text-gray-600">現在の全体のこり時間</p>
                <div className="text-2xl font-mono font-black text-red-700">
                  {(() => {
                    const end = new Date(globalTimerEndAt);
                    const diff = Math.floor((end - now) / 1000);
                    if (diff <= 0) return '終了しました';
                    return `${Math.floor(diff / 86400)}日 ${Math.floor((diff % 86400) / 3600)
                      .toString()
                      .padStart(2, '0')}:${Math.floor((diff % 3600) / 60)
                      .toString()
                      .padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
                  })()}
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">日</label>
                <input
                  type="number"
                  min="0"
                  value={globalTimerDays}
                  onChange={(e) => setGlobalTimerDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-white border-2 border-gray-900 rounded-lg px-2 py-1.5 font-black text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">時間</label>
                <input
                  type="number"
                  min="0"
                  value={globalTimerHours}
                  onChange={(e) => setGlobalTimerHours(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-white border-2 border-gray-900 rounded-lg px-2 py-1.5 font-black text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">分</label>
                <input
                  type="number"
                  min="0"
                  value={globalTimerMinutes}
                  onChange={(e) => setGlobalTimerMinutes(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-white border-2 border-gray-900 rounded-lg px-2 py-1.5 font-black text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">秒</label>
                <input
                  type="number"
                  min="0"
                  value={globalTimerSeconds}
                  onChange={(e) => setGlobalTimerSeconds(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-white border-2 border-gray-900 rounded-lg px-2 py-1.5 font-black text-center"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  updateGlobalTimer(
                    globalTimerDays * 86400 +
                      globalTimerHours * 3600 +
                      globalTimerMinutes * 60 +
                      globalTimerSeconds
                  )
                }
                className="flex-1 tactile-btn bg-red-600 hover:bg-red-500 text-white py-2 font-black text-sm"
              >
                全体タイマー開始/更新
              </button>
              <button
                type="button"
                onClick={() => updateGlobalTimer(0)}
                className="flex-1 tactile-btn bg-white hover:bg-gray-100 text-gray-900 py-2 font-black text-sm"
              >
                停止/クリア
              </button>
            </div>
          </div>

          {/* クイズイベント一覧 */}
          <div className="tactile-card bg-white overflow-hidden">
            <div className="p-4 bg-amber-100 border-b-[3px] border-gray-900">
              <h2 className="text-lg sm:text-xl font-black text-gray-900">
                登録済みクイズブロック一覧
              </h2>
            </div>
            <div className="divide-y-[3px] divide-gray-900">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="p-5 space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 mb-1">{quiz.title}</h3>
                    <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
                      <span className="bg-amber-100 text-gray-900 px-2.5 py-1 rounded border-2 border-gray-900">
                        コード: {quiz.code}
                      </span>
                      <span className="bg-blue-100 text-blue-900 px-2.5 py-1 rounded border-2 border-gray-900">
                        モード: {quiz.mode}
                      </span>
                    </div>
                  </div>

                  {/* ステータス管理パネル */}
                  <div className="bg-[#FFFDF7] p-4 rounded-xl border-2 border-gray-900 space-y-3">
                    {/* 1. イベント公開 */}
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm font-black text-gray-800">1. アクセス状態</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuizStatus(
                            quiz.id,
                            'visibility',
                            quiz.visibility === 'open' ? 'closed' : 'open'
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg font-black text-xs border-2 border-gray-900 ${
                          quiz.visibility === 'open'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {quiz.visibility === 'open' ? '公開中 (Open)' : '閉鎖中 (Closed)'}
                      </button>
                    </div>

                    {/* 2. 進行ステータス */}
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <span className="text-sm font-black text-gray-800">2. クイズ進行</span>
                      {quiz.play_status === 'started' && quiz.timer_end_at && (
                        <div className="text-xs font-black bg-amber-200 px-2.5 py-1 rounded border border-gray-900">
                          残り:{' '}
                          {(() => {
                            const end = new Date(quiz.timer_end_at);
                            const diff = Math.floor((end - now) / 1000);
                            if (diff <= 0) return <span className="text-red-700">時間切れ</span>;
                            const h = Math.floor(diff / 3600);
                            const m = Math.floor((diff % 3600) / 60);
                            const s = diff % 60;
                            return `${h.toString().padStart(2, '0')}:${m
                              .toString()
                              .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                          })()}
                        </div>
                      )}
                      <div className="flex bg-white rounded-lg p-1 border-2 border-gray-900 gap-1">
                        <button
                          type="button"
                          onClick={() => updateQuizStatus(quiz.id, 'play_status', 'waiting')}
                          className={`px-3 py-1 text-xs font-black rounded ${
                            quiz.play_status === 'waiting'
                              ? 'bg-amber-400 text-gray-900 border border-gray-900'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          待機
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQuizStatus(quiz.id, 'play_status', 'started')}
                          className={`px-3 py-1 text-xs font-black rounded ${
                            quiz.play_status === 'started'
                              ? 'bg-blue-700 text-white border border-gray-900'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          開始
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQuizStatus(quiz.id, 'play_status', 'ended')}
                          className={`px-3 py-1 text-xs font-black rounded ${
                            quiz.play_status === 'ended'
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          終了
                        </button>
                      </div>
                    </div>

                    {/* 3. 結果・解説の公開モード切り替え（クイズコード・ブロック単位でワンタッチ変更可能！） */}
                    <div className="flex flex-wrap justify-between items-center gap-2 pt-1 border-t border-gray-300">
                      <span className="text-sm font-black text-blue-900">
                        3. 結果・解説の公開
                      </span>
                      <div className="flex bg-white rounded-lg p-1 border-2 border-gray-900 gap-1">
                        <button
                          type="button"
                          onClick={() => updateQuizStatus(quiz.id, 'result_display', 'immediate')}
                          className={`px-2.5 py-1 text-xs font-black rounded ${
                            (quiz.result_display || 'immediate') === 'immediate'
                              ? 'bg-emerald-700 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          解いたら即公開
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQuizStatus(quiz.id, 'result_display', 'after_end')}
                          className={`px-2.5 py-1 text-xs font-black rounded ${
                            quiz.result_display === 'after_end'
                              ? 'bg-amber-400 text-gray-900 border border-gray-900'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          時間終了後に公開
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => viewResults(quiz)}
                      className="flex-1 tactile-btn bg-blue-700 hover:bg-blue-600 text-white py-2.5 font-black text-sm flex items-center justify-center gap-1.5"
                    >
                      <PixelIcon name="trophy" size={20} />
                      <span>参加者の得点を見る</span>
                    </button>
                    <a
                      href={`/admin/edit?code=${quiz.code}&id=${quiz.id}`}
                      className="tactile-btn bg-white hover:bg-gray-100 text-gray-900 px-4 py-2.5 font-black text-sm flex items-center justify-center"
                    >
                      編集する
                    </a>
                  </div>
                </div>
              ))}
              {quizzes.length === 0 && (
                <div className="p-8 text-center text-gray-600 font-black">
                  まだクイズがありません。「新規クイズ作成」から作成してください。
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右カラム：参加者の成績一覧 */}
        <div className="w-full xl:w-7/12">
          {selectedQuiz ? (
            <div className="tactile-card bg-white overflow-hidden">
              <div className="p-5 border-b-[3px] border-gray-900 bg-emerald-100 flex flex-wrap justify-between items-end gap-2">
                <div className="flex items-center gap-3">
                  <PixelIcon name="trophy" size={36} />
                  <div>
                    <h2 className="text-xl font-black text-gray-900">参加者スコアランキング</h2>
                    <p className="text-gray-800 text-sm font-bold">{selectedQuiz.title}</p>
                  </div>
                </div>
                <div className="bg-white border-2 border-gray-900 px-3 py-1 rounded-lg text-sm text-gray-900 font-black">
                  参加者: {results.length} 名
                </div>
              </div>
              <div className="overflow-x-auto">
                {loading ? (
                  <p className="text-center text-gray-700 font-black p-10">読み込み中...</p>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[640px]">
                    <thead>
                      <tr className="bg-amber-50 border-b-[3px] border-gray-900 text-sm font-black text-gray-900">
                        <th className="p-3.5 w-16 text-center">順位</th>
                        <th
                          className="p-3.5 cursor-pointer hover:text-blue-700"
                          onClick={() => handleSort('student_id')}
                        >
                          番号 {sortField === 'student_id' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="p-3.5 cursor-pointer hover:text-blue-700"
                          onClick={() => handleSort('user_name')}
                        >
                          お名前 {sortField === 'user_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="p-3.5 cursor-pointer hover:text-blue-700"
                          onClick={() => handleSort('total_score')}
                        >
                          合計点 {sortField === 'total_score' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="p-3.5 cursor-pointer hover:text-blue-700"
                          onClick={() => handleSort('attempt_count')}
                        >
                          解答数 {sortField === 'attempt_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="p-3.5 cursor-pointer hover:text-blue-700"
                          onClick={() => handleSort('correct_count')}
                        >
                          正解数 {sortField === 'correct_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="p-3.5 cursor-pointer hover:text-blue-700"
                          onClick={() => handleSort('accuracy')}
                        >
                          正答率 {sortField === 'accuracy' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-gray-200 font-bold">
                      {sortedResults.length > 0 ? (
                        sortedResults.map((res, i) => (
                          <tr key={i} className="hover:bg-amber-50/50">
                            <td className="p-3.5 text-center font-black text-gray-900">{i + 1}</td>
                            <td className="p-3.5 font-mono text-sm text-gray-700">
                              {res.student_id}
                            </td>
                            <td className="p-3.5 font-black text-gray-900">{res.user_name}</td>
                            <td className="p-3.5 font-black text-blue-800 text-lg">
                              {res.total_score} <span className="text-xs">pt</span>
                            </td>
                            <td className="p-3.5 text-gray-800">{res.attempt_count}</td>
                            <td className="p-3.5 text-emerald-800 font-black">
                              {res.correct_count}
                            </td>
                            <td className="p-3.5 font-mono text-gray-900">
                              {res.accuracy ? res.accuracy.toFixed(1) : 0}%
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="p-10 text-center text-gray-600 font-black">
                            まだ回答した参加者がいません。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="tactile-card bg-white p-10 text-center text-gray-700 font-black min-h-[360px] flex flex-col justify-center items-center gap-3">
              <PixelIcon name="trophy" size={48} />
              <p className="text-lg">
                左のリストから「参加者の得点を見る」ボタンを押すと、ここにランキングが表示されます。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;

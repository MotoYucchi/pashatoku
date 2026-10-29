import React from 'react';
import PixelIcon from './PixelIcon';

function TermsModal({ isOpen, onClose, type }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="tactile-card w-full max-w-2xl flex flex-col max-h-[85dvh] bg-white overflow-hidden">
        <div className="p-5 border-b-[3px] border-gray-900 flex justify-between items-center bg-amber-100">
          <div className="flex items-center gap-3">
            <PixelIcon name="book" size={32} />
            <h2 className="text-xl sm:text-2xl font-black text-gray-900">
              {type === 'pashatoku' ? 'パシャトク 利用規約' : '主催者 利用規約'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tactile-btn px-4 py-2 bg-white hover:bg-gray-100 text-gray-900 font-black text-base"
          >
            とじる
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-base sm:text-lg text-gray-900 leading-relaxed space-y-6 bg-white">
          {type === 'pashatoku' ? (
            <>
              <section>
                <h3 className="text-blue-800 font-black text-lg sm:text-xl mb-2 border-b-2 border-blue-200 pb-1">
                  第1条（適用）
                </h3>
                <p>
                  本利用規約（以下「本規約」）は、パシャトク（PASHATOKU.COM、以下「本サービス」）が提供するクイズシステムの利用条件を定めるものです。参加される方は、本規約に同意した上でご利用ください。
                </p>
              </section>

              <section>
                <h3 className="text-blue-800 font-black text-lg sm:text-xl mb-2 border-b-2 border-blue-200 pb-1">
                  第2条（お名前・番号の保存とCookieについて）
                </h3>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    本サービスでは、画面を閉じても続きから遊べるようにするため、ブラウザのCookie（クッキー）を使ってお名前や番号、同意状況を保存します。
                  </li>
                  <li>
                    保存された情報は、クイズの採点や結果表示のためにのみ使用し、外部へ販売・提供することは一切ありません。
                  </li>
                </ol>
              </section>

              <section>
                <h3 className="text-blue-800 font-black text-lg sm:text-xl mb-2 border-b-2 border-blue-200 pb-1">
                  第3条（免責事項）
                </h3>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    本サービスは、出題されるクイズの内容や正確性に関して責任を負いません。
                  </li>
                  <li>
                    通信環境や機器の不具合等により画面が開けない場合でも、当システムは損害等の責任を負いかねますのでご了承ください。
                  </li>
                </ol>
              </section>

              <section>
                <h3 className="text-blue-800 font-black text-lg sm:text-xl mb-2 border-b-2 border-blue-200 pb-1">
                  第4条（禁止事項）
                </h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>周囲の安全を確認せず、歩きながらスマートフォンを操作する行為（歩きスマホ）</li>
                  <li>システムに過度な負担をかける行為や、不正な方法で得点を操作する行為</li>
                </ul>
              </section>
            </>
          ) : (
            <>
              <div className="p-4 rounded-xl border-2 border-gray-900 bg-amber-50 font-bold text-gray-900">
                イベント主催者（研究室・学校・運営スタッフ）からのお知らせとお願いです。
              </div>

              <section>
                <h3 className="text-emerald-800 font-black text-lg sm:text-xl mb-2 border-b-2 border-emerald-200 pb-1">
                  イベント・クイズ参加に関するお約束
                </h3>
                <p>本クイズイベントに参加されるみなさまは、以下のルールを守って楽しく遊んでください。</p>
                <ul className="list-disc pl-6 mt-3 space-y-2">
                  <li>会場や教室内では走らず、まわりの人や展示物に気をつけて移動してください。</li>
                  <li>クイズのスコアや回答記録は、イベントの集計や展示の改善のために利用されます。</li>
                  <li>開催中の問題の答えをまだ解いていない人に大声で教えたり、SNSへ無断で投稿したりしないでください。</li>
                </ul>
              </section>
            </>
          )}
        </div>

        <div className="p-4 border-t-[3px] border-gray-900 bg-amber-50 text-center">
          <button
            type="button"
            onClick={onClose}
            className="tactile-btn bg-blue-700 hover:bg-blue-600 text-white font-black text-lg py-3 px-12"
          >
            確認してとじる
          </button>
        </div>
      </div>
    </div>
  );
}

export default TermsModal;

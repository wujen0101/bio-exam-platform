import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UNITS } from '../utils/units'
import { getQuestionCounts } from '../firebase/questions'

const UNIT_ICONS = ['🔬','🫀','🧪','🧬','💉','🦠','🌿','🦕','🌍']

function HomePage() {
  const [expandedUnit, setExpandedUnit] = useState(null)
  const [unitCounts, setUnitCounts] = useState({})
  const [chapterCounts, setChapterCounts] = useState({})

  useEffect(() => {
    getQuestionCounts(UNITS).then(({ unitCounts, chapterCounts }) => {
      setUnitCounts(unitCounts)
      setChapterCounts(chapterCounts)
    })
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center text-primary mb-1">後中醫生物學線上測驗</h1>
      <p className="text-center text-gray-500 mb-8 text-sm">共 9 單元・38 章・涵蓋中國、慈濟、義守、高醫、清華、中興、中山</p>

      {/* 測驗模式 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <div className="bg-white rounded-2xl shadow p-5 sm:p-6 border-l-4 border-primary">
          <h2 className="text-xl font-bold mb-1">📝 單元測驗</h2>
          <p className="text-gray-500 text-sm mb-4">選擇一個或多個單元，針對特定主題精準練習</p>
          <Link
            to="/exam?mode=unit"
            className="block text-center bg-primary text-white py-2 rounded-lg hover:bg-green-800 transition font-medium"
          >
            開始單元測驗
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 sm:p-6 border-l-4 border-secondary">
          <h2 className="text-xl font-bold mb-1">🎯 模擬考</h2>
          <p className="text-gray-500 text-sm mb-4">全部單元，依歷年各校考古題比率或自訂比率出題</p>
          <Link
            to="/exam?mode=mock"
            className="block text-center bg-secondary text-white py-2 rounded-lg hover:bg-blue-900 transition font-medium"
          >
            開始模擬考
          </Link>
        </div>
      </div>

      {/* 單元清單 */}
      <h2 className="text-lg font-semibold mb-3 text-gray-700">📚 選擇單元練習</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {UNITS.map((unit, idx) => {
          const isExpanded = expandedUnit === unit.id
          return (
            <div key={unit.id} className="bg-white rounded-xl shadow overflow-hidden">
              {/* 單元列 */}
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-2xl mt-0.5">{UNIT_ICONS[idx]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <Link
                      to={`/exam?mode=unit&units=${unit.id}`}
                      className="font-semibold text-gray-800 text-sm hover:text-primary transition"
                    >
                      {unit.name}
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      {unitCounts[unit.id] != null && (
                        <span className="text-xs bg-green-50 text-green-700 rounded px-1.5 py-0.5">
                          {unitCounts[unit.id]}題
                        </span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                        {Math.round(unit.exam_ratio * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{unit.title_zh}</div>
                </div>
                {/* 展開章節按鈕 */}
                <button
                  onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}
                  className="shrink-0 text-gray-400 hover:text-primary transition text-xs mt-1 px-1"
                  title="展開章節"
                >
                  {isExpanded ? '▾' : '▸'}
                </button>
              </div>

              {/* 章節列表 */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-3 pb-3 pt-2 flex flex-col gap-1">
                  {unit.chapters.map(ch => (
                    <Link
                      key={ch.id}
                      to={`/exam?mode=unit&chapters=${ch.id}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-50 text-xs text-gray-600 hover:text-primary transition"
                    >
                      <span className="text-gray-300">│</span>
                      <span className="font-medium text-gray-400 w-8 shrink-0">Ch{ch.no}</span>
                      <span className="flex-1">{ch.zh}</span>
                      {chapterCounts[ch.id] != null && (
                        <span className="shrink-0 text-gray-400">{chapterCounts[ch.id]}題</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        % = 112年學士後醫暨後中醫綜合出題比率（7校統計）
      </p>
    </div>
  )
}

export default HomePage

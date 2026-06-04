import { Link } from 'react-router-dom'
import { UNITS } from '../utils/units'

const UNIT_ICONS = ['🔬','🫀','🧪','🧬','💉','🦠','🌿','🦕','🌍']

function HomePage() {
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
        {UNITS.map((unit, idx) => (
          <Link
            key={unit.id}
            to={`/exam?mode=unit&units=${unit.id}`}
            className="bg-white rounded-xl shadow px-4 py-3 flex items-start gap-3 hover:shadow-md transition group"
          >
            <span className="text-2xl mt-0.5">{UNIT_ICONS[idx]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-gray-800 text-sm">{unit.name}</span>
                <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 shrink-0">
                  {Math.round(unit.exam_ratio * 100)}%
                </span>
              </div>
              <div className="text-xs text-gray-500 truncate">{unit.title_zh}</div>
              <div className="text-xs text-gray-400">{unit.chapters.length} 章</div>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        % = 112年學士後醫暨後中醫綜合出題比率（7校統計）
      </p>
    </div>
  )
}

export default HomePage

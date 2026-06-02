import { Link } from 'react-router-dom'

const UNITS = [
  { id: 'unit1', name: 'Unit 1', title: 'Cell Biology 細胞生物學' },
  { id: 'unit2', name: 'Unit 2', title: 'Genetics 遺傳學' },
  { id: 'unit3', name: 'Unit 3', title: 'Molecular Biology 分子生物學' },
  { id: 'unit4', name: 'Unit 4', title: 'Evolution 演化' },
  { id: 'unit5', name: 'Unit 5', title: 'Ecology 生態學' },
  { id: 'unit7', name: 'Unit 7', title: 'Plant Biology 植物生物學' },
  { id: 'unit8', name: 'Unit 8', title: 'Animal Physiology 動物生理學' },
  { id: 'unit9', name: 'Unit 9', title: 'Diversity 生物多樣性' },
]

function HomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center text-primary mb-2">後中醫生物學線上測驗</h1>
      <p className="text-center text-gray-500 mb-8">選擇測驗模式開始練習</p>

      {/* 測驗模式選擇 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* 單元測驗 */}
        <div className="bg-white rounded-2xl shadow p-6 border-l-4 border-primary">
          <h2 className="text-xl font-bold mb-2">📝 單元測驗</h2>
          <p className="text-gray-500 text-sm mb-4">選擇一個或多個單元，針對特定主題練習</p>
          <Link
            to="/exam?mode=unit"
            className="block text-center bg-primary text-white py-2 rounded-lg hover:bg-green-800 transition"
          >
            開始單元測驗
          </Link>
        </div>

        {/* 模擬考 */}
        <div className="bg-white rounded-2xl shadow p-6 border-l-4 border-secondary">
          <h2 className="text-xl font-bold mb-2">🎯 模擬考</h2>
          <p className="text-gray-500 text-sm mb-4">全部單元範圍，模擬正式後中醫考試</p>
          <Link
            to="/exam?mode=mock"
            className="block text-center bg-secondary text-white py-2 rounded-lg hover:bg-blue-900 transition"
          >
            開始模擬考
          </Link>
        </div>
      </div>

      {/* 單元清單 */}
      <h2 className="text-xl font-semibold mb-4">📚 題庫單元</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {UNITS.map(unit => (
          <Link
            key={unit.id}
            to={`/exam?mode=unit&units=${unit.id}`}
            className="bg-white rounded-xl shadow px-5 py-4 flex items-center gap-3 hover:shadow-md transition"
          >
            <span className="text-2xl">🔬</span>
            <div>
              <div className="font-semibold text-gray-800">{unit.name}</div>
              <div className="text-sm text-gray-500">{unit.title}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default HomePage

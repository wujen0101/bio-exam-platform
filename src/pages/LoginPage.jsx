function LoginPage() {
  return (
    <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow p-8 text-center">
      <h1 className="text-2xl font-bold mb-2">登入</h1>
      <p className="text-gray-500 mb-8">使用 Google 帳號登入以記錄學習進度</p>
      <button className="flex items-center justify-center gap-3 w-full border rounded-lg py-3 hover:bg-gray-50 transition">
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
        <span>使用 Google 帳號登入</span>
      </button>
    </div>
  )
}

export default LoginPage

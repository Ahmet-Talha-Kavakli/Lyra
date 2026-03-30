export default function Loading() {
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Lyra</h1>
        <p className="text-slate-400">Initializing...</p>
      </div>
    </div>
  );
}

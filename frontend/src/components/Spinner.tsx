/**
 * Loading Spinner for 3D Model Loading
 */

export function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-slate-600 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin" />
      </div>
      <p className="text-slate-400 text-sm">Loading mascot...</p>
    </div>
  );
}

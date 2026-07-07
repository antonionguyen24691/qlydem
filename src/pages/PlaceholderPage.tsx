export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">{title}</h1>
      <div className="flex-1 rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-6 flex items-center justify-center text-gray-400">
        Tính năng đang được phát triển
      </div>
    </div>
  );
}

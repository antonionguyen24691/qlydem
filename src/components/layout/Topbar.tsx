import { Bell, Search, User, Menu } from "lucide-react";
import { useUIStore } from "../../store/ui";

export function Topbar() {
  const { toggleSidebar } = useUIStore();
  
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 shrink-0">
      <div className="flex flex-1 items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-[#006B68]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative w-full max-w-md hidden sm:block">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input 
            type="text" 
            className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#006B68] sm:text-sm sm:leading-6" 
            placeholder="Tìm kiếm thông tin (F3)..." 
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#006B68] rounded-md">
          <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 border-l pl-4 cursor-pointer hover:opacity-80">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="h-5 w-5 text-gray-500" />
          </div>
          <div className="hidden md:block text-sm">
            <div className="font-medium text-gray-700">Admin User</div>
            <div className="text-xs text-gray-500">Quản trị viên</div>
          </div>
        </div>
      </div>
    </header>
  );
}

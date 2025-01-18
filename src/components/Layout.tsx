import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#141517]">
      <header className="bg-[#1a1b1e] border-b border-gray-800">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-orange-500">DogeBridge</span>
            </div>
            <div className="flex items-center space-x-4">
              <a href="#" className="text-gray-300 hover:text-orange-500 px-3 py-2 rounded-md text-sm font-medium">Bridge</a>
              <a href="#" className="text-gray-300 hover:text-orange-500 px-3 py-2 rounded-md text-sm font-medium">Stake</a>
              <a href="#" className="text-gray-300 hover:text-orange-500 px-3 py-2 rounded-md text-sm font-medium">Lend</a>
            </div>
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[#1a1b1e] rounded-lg border border-gray-800 p-6">
          {children}
        </div>
      </main>
      <footer className="bg-[#1a1b1e] border-t border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-400">
            © 2024 DogeBridge. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
} 
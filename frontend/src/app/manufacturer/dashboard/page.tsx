"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  userId: string;
  name: string;
  businessId: string;
  role: number;
  roleName: string;
}

export default function ManufacturerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const userData = sessionStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 2) {
      router.push("/login");
      return;
    }

    setUser(parsedUser);
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-600 mb-4"></div>
          <p className="text-xl text-gray-700 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-2xl">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Manufacturer Dashboard
                </h1>
                <p className="text-sm text-gray-600 font-medium">
                  Welcome back, {user.name} 👋
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-xl transition-all transform hover:scale-105 shadow-lg font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* User Info Card */}
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl p-8 mb-8 border border-white/50">
          <div className="flex items-center mb-6">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-xl mr-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">
              Account Information
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600 font-semibold mb-1">
                User ID
              </p>
              <p className="font-bold text-lg text-gray-900">{user.userId}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600 font-semibold mb-1">Name</p>
              <p className="font-bold text-lg text-gray-900">{user.name}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600 font-semibold mb-1">
                Business ID
              </p>
              <p className="font-bold text-lg text-gray-900">
                {user.businessId}
              </p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600 font-semibold mb-1">Role</p>
              <p className="font-bold text-lg text-gray-900">{user.roleName}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">
            Quick Actions
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <button className="group bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white p-8 rounded-2xl shadow-xl transition-all transform hover:scale-105 hover:shadow-2xl">
            <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3">Register Location</h3>
            <p className="text-sm opacity-90">
              Add factory, distribution, or sorting centres
            </p>
          </button>

          <button className="group bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white p-8 rounded-2xl shadow-xl transition-all transform hover:scale-105 hover:shadow-2xl">
            <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3">Create Medicine Batch</h3>
            <p className="text-sm opacity-90">
              Create new medicine batch for hospital delivery
            </p>
          </button>

          <button className="group bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white p-8 rounded-2xl shadow-xl transition-all transform hover:scale-105 hover:shadow-2xl">
            <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3">View Batches</h3>
            <p className="text-sm opacity-90">
              Track and update medicine batch status
            </p>
          </button>
        </div>
      </main>
    </div>
  );
}

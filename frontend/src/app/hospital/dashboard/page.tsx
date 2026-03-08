"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  userId: string;
  roleName: string;
}

export default function HospitalDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [manufacturerData, setManufacturerData] = useState({
    manufacturerId: "",
    manufacturerName: "",
    manufacturerBusinessId: "",
    manufacturerPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    // Check if user is logged in
    const userData = sessionStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.roleName !== "Hospital") {
      router.push("/login");
      return;
    }

    setUser(parsedUser);
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    router.push("/login");
  };

  const handleRegisterManufacturer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate passwords match
    if (
      manufacturerData.manufacturerPassword !== manufacturerData.confirmPassword
    ) {
      setError("Passwords do not match");
      return;
    }

    // Validate password length
    if (manufacturerData.manufacturerPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Get hospital password from user
      const hospitalPassword = prompt(
        "Please enter your hospital password to confirm:",
      );
      if (!hospitalPassword) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/register-manufacturer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hospitalId: user?.userId,
          hospitalPassword,
          manufacturerId: manufacturerData.manufacturerId,
          manufacturerName: manufacturerData.manufacturerName,
          manufacturerBusinessId: manufacturerData.manufacturerBusinessId,
          manufacturerPassword: manufacturerData.manufacturerPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setSuccess(
        `Manufacturer ${manufacturerData.manufacturerId} registered successfully!`,
      );

      // Reset form
      setManufacturerData({
        manufacturerId: "",
        manufacturerName: "",
        manufacturerBusinessId: "",
        manufacturerPassword: "",
        confirmPassword: "",
      });

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowRegisterModal(false);
        setSuccess("");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
          <p className="text-xl text-gray-700 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-2xl border-b-4 border-blue-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            {/* Left Section */}
            <div className="flex items-center space-x-6">
              {/* Icon */}
              <div className="bg-white/20 backdrop-blur-lg p-4 rounded-2xl hover:bg-white/30 transition-all">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>

              {/* Title & Welcome */}
              <div className="flex flex-col">
                <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                  Hospital Dashboard
                </h1>
                <p className="text-blue-100 font-medium mt-1">
                  Welcome back,{" "}
                  <span className="font-bold text-white">{user.userId}</span> 👋
                </p>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-4">
              {/* Status Badge */}
              <div className="bg-white/20 backdrop-blur-lg px-6 py-3 rounded-xl hidden md:flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-white font-semibold">Online</span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="bg-white hover:bg-red-50 text-red-600 font-bold px-8 py-3 rounded-xl transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* User Info Card */}
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl p-8 mb-8 border border-white/50">
          <div className="flex items-center mb-6">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-2 rounded-xl mr-3">
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
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600 font-semibold mb-1">
                User ID
              </p>
              <p className="font-bold text-lg text-gray-900">{user.userId}</p>
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
          <button
            onClick={() => setShowRegisterModal(true)}
            className="group bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white p-8 rounded-2xl shadow-xl transition-all transform hover:scale-105 hover:shadow-2xl"
          >
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
            <h3 className="text-2xl font-bold mb-3">Register Manufacturer</h3>
            <p className="text-sm opacity-90">
              Add a new manufacturer to the blockchain system
            </p>
          </button>

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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3">Medicine Batches</h3>
            <p className="text-sm opacity-90">
              Track and verify all medicine deliveries
            </p>
          </button>

          <button className="group bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white p-8 rounded-2xl shadow-xl transition-all transform hover:scale-105 hover:shadow-2xl">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3">Flagged Batches</h3>
            <p className="text-sm opacity-90">
              Review and manage suspicious medicine batches
            </p>
          </button>
        </div>
      </main>

      {/* Register Manufacturer Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Register Manufacturer
                </h2>
                <button
                  onClick={() => {
                    setShowRegisterModal(false);
                    setError("");
                    setSuccess("");
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleRegisterManufacturer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manufacturer ID
                  </label>
                  <input
                    type="text"
                    value={manufacturerData.manufacturerId}
                    onChange={(e) =>
                      setManufacturerData({
                        ...manufacturerData,
                        manufacturerId: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g., MFG001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manufacturer Name
                  </label>
                  <input
                    type="text"
                    value={manufacturerData.manufacturerName}
                    onChange={(e) =>
                      setManufacturerData({
                        ...manufacturerData,
                        manufacturerName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Company Name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business ID
                  </label>
                  <input
                    type="text"
                    value={manufacturerData.manufacturerBusinessId}
                    onChange={(e) =>
                      setManufacturerData({
                        ...manufacturerData,
                        manufacturerBusinessId: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Business Registration ID"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={manufacturerData.manufacturerPassword}
                    onChange={(e) =>
                      setManufacturerData({
                        ...manufacturerData,
                        manufacturerPassword: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Minimum 6 characters"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={manufacturerData.confirmPassword}
                    onChange={(e) =>
                      setManufacturerData({
                        ...manufacturerData,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Re-enter password"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    {success}
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setError("");
                      setSuccess("");
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:bg-gray-400"
                  >
                    {loading ? "Registering..." : "Register"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

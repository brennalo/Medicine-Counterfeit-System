"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HospitalLogin() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified login
    router.push("/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
        <p className="text-xl text-gray-700 font-semibold">
          Redirecting to login...
        </p>
      </div>
    </div>
  );
}

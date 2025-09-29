"use client";

import { useState } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export default function UserForm() {
  const [name, setName] = useState("");
  const [deviceUserId, setDeviceUserId] = useState("");

  const handleSubmit = async e => {
    e.preventDefault();

    if (!name || !deviceUserId) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      await addDoc(collection(db, "polymer_attendance_users"), {
        name,
        deviceUserId,
        createdAt: new Date(),
      });

      setName("");
      setDeviceUserId("");
      alert("User added ✅ (Run sync-users to push to device)");
    } catch (err) {
      console.error(err);
      alert("Error adding user");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white shadow">
      <h2 className="font-bold mb-2">Add New User</h2>

      <div className="mb-2">
        <label className="block text-sm">Name</label>
        <input
          type="text"
          className="w-full p-2 border rounded"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="mb-2">
        <label className="block text-sm">Device User ID</label>
        <input
          type="text"
          className="w-full p-2 border rounded"
          value={deviceUserId}
          onChange={e => setDeviceUserId(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save
      </button>
    </form>
  );
}

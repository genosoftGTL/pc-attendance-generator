// components/HolidaysManager.js
"use client";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function HolidaysManager() {
  const [list, setList] = useState([]);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const snap = await getDocs(collection(db, "PCA Holidays"));
    setList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function addHoliday(e) {
    e.preventDefault();
    if (!date) return alert("Pick a date");
    await addDoc(collection(db, "PCA Holidays"), { date, name, createdAt: new Date() });
    setDate(""); setName("");
    load();
  }

  async function remove(id) {
    if (!confirm("Remove holiday?")) return;
    await deleteDoc(doc(db, "PCA Holidays", id));
    load();
  }

  return (
    <div className="bg-white p-4 text-black rounded shadow">
      <h3 className="font-semibold">Holidays</h3>
      <form onSubmit={addHoliday} className="flex gap-2 my-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="p-2 border" />
        <input placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} className="p-2 border" />
        <button className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
      </form>

      <ul className="mt-3 space-y-1">
        {list.map(h => (
          <li key={h.id} className="flex justify-between">
            <span>{h.date} — {h.name}</span>
            <button onClick={() => remove(h.id)} className="text-red-600">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

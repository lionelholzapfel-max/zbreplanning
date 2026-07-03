'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Spinner } from '@/components/ui';

interface DrereAward {
  user_id: string;
  member_name: string;
  award_date: string;
  points_earned: number;
  celebration_seen_at: string | null;
}

export default function AdminPage() {
  const [drereAwards, setDrereAwards] = useState<DrereAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/drere-celebrations')
      .then(res => res.json())
      .then(data => {
        setDrereAwards(data.awards || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black text-white mb-8">Admin - Célébrations Drère</h1>

        <div className="bg-[#12121a] rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Date</th>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Drère</th>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Points</th>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Célébration vue</th>
              </tr>
            </thead>
            <tbody>
              {drereAwards.map((award, idx) => (
                <tr key={idx} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white">{award.award_date}</td>
                  <td className="px-4 py-3 text-white font-medium">{award.member_name}</td>
                  <td className="px-4 py-3 text-[#fbbf24] font-bold">{award.points_earned} pts</td>
                  <td className="px-4 py-3">
                    {award.celebration_seen_at ? (
                      <span className="text-green-400 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full" />
                        {new Date(award.celebration_seen_at).toLocaleString('fr-BE', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    ) : (
                      <span className="text-gray-500 flex items-center gap-2">
                        <span className="w-2 h-2 bg-gray-500 rounded-full" />
                        Pas encore
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

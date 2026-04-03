import React, { useEffect, useState } from 'react';
import { UserProfile } from '@clerk/clerk-react';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import type { User } from '@/hooks/useAuth.ts';

interface UserProfilePageProps {
  user: User;
}

export const UserProfilePage = ({ user }: UserProfilePageProps) => {
  const [fullName, setFullName] = useState(user.fullName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(user.fullName || '');
  }, [user.fullName]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: user.email,
          role: user.role,
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfil</h1>
        <p className="text-sm text-gray-500">Atualize os seus dados e a sua palavra-passe.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase text-gray-400">Nome completo</label>
            <input
              className="w-full px-4 py-2 border rounded-lg"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Maria Joao Silva"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-gray-400">Email</label>
            <input
              className="w-full px-4 py-2 border rounded-lg bg-gray-50"
              value={user.email || ''}
              readOnly
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving || !fullName.trim()}>
            {saving ? 'A guardar...' : 'Guardar dados'}
          </Button>
          {saved && <span className="text-xs text-emerald-600 font-medium">Dados atualizados.</span>}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">Seguranca e acesso</h2>
        <UserProfile routing="path" path="/profile" />
      </Card>
    </div>
  );
};

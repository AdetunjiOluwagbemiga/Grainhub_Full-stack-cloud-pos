import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useUpdateUser, type UserProfile } from '../../hooks/useUsers';

interface EditUserModalProps {
  user: UserProfile;
  onClose: () => void;
}

export function EditUserModal({ user, onClose }: EditUserModalProps) {
  const updateUser = useUpdateUser();
  const [formData, setFormData] = useState({
    full_name: user.full_name,
    role: user.role,
    pin_code: user.pin_code || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await updateUser.mutateAsync({
      id: user.id,
      updates: {
        full_name: formData.full_name,
        role: formData.role,
        pin_code: formData.pin_code || null,
      },
    });

    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <Input
            type="email"
            value={user.email}
            disabled
            className="bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <Input
            type="text"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role *
          </label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PIN Code (Optional)
          </label>
          <Input
            type="text"
            value={formData.pin_code}
            onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
            placeholder="4-digit PIN"
            maxLength={4}
            pattern="[0-9]{4}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional 4-digit PIN for quick login at POS
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" onClick={onClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={updateUser.isPending}
          >
            {updateUser.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

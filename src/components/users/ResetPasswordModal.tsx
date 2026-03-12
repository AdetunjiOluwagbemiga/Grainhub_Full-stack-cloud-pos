import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useResetPassword, type UserProfile } from '../../hooks/useUsers';

interface ResetPasswordModalProps {
  user: UserProfile;
  onClose: () => void;
}

export function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps) {
  const resetPassword = useResetPassword();
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    await resetPassword.mutateAsync({
      userId: user.id,
      newPassword: formData.newPassword,
    });

    onClose();
  };

  return (
    <Modal onClose={onClose} title="Reset Password">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Reset password for <span className="font-medium">{user.full_name}</span>
        </p>
        <p className="text-sm text-gray-500">{user.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password *
          </label>
          <Input
            type="password"
            value={formData.newPassword}
            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
            required
            minLength={6}
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password *
          </label>
          <Input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
            minLength={6}
            placeholder="Confirm password"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" onClick={onClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={resetPassword.isPending}
          >
            {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

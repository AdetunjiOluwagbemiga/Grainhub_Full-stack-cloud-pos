import { useState } from 'react';
import { DollarSign, Clock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useOpenShift } from '../../hooks/useShifts';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OpenShiftModal({ isOpen, onClose }: OpenShiftModalProps) {
  const [openingFloat, setOpeningFloat] = useState('100.00');
  const openShift = useOpenShift();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const floatAmount = parseFloat(openingFloat);
    if (isNaN(floatAmount) || floatAmount < 0) {
      return;
    }

    openShift.mutate(
      { opening_float: floatAmount },
      {
        onSuccess: () => {
          onClose();
          setOpeningFloat('100.00');
        },
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Open Shift">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Starting Your Shift</h4>
              <p className="text-sm text-blue-700 mt-1">
                Count the physical cash in your drawer and enter the amount below to open your shift.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Opening Float (Starting Cash)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              className="pl-10 text-lg"
              placeholder="100.00"
              required
              autoFocus
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            This is the cash you have in the drawer at the start of your shift
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={openShift.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={openShift.isPending}
            className="flex-1"
          >
            {openShift.isPending ? 'Opening...' : 'Open Shift'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

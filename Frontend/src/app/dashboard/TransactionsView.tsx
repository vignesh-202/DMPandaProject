import React from 'react';
import PlaceholderView from './PlaceholderView';
import { Landmark } from 'lucide-react';

const TransactionsView: React.FC = () => {
  return (
    <PlaceholderView
      title="Transactions"
      description="View and manage your subscription history and professional automation invoices."
      icon={<Landmark className="w-12 h-12 text-primary" />}
    />
  );
};

export default TransactionsView;

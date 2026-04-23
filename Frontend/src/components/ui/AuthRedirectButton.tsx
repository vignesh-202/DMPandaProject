import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AuthRedirectButtonProps {
  children: React.ReactNode;
  className?: string;
}

const AuthRedirectButton: React.FC<AuthRedirectButtonProps> = ({ children, className }) => {
  const { isAuthenticated, authHint } = useAuth();
  const to = isAuthenticated || authHint ? '/dashboard' : '/login';

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
};

export default AuthRedirectButton;

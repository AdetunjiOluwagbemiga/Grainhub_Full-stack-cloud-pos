import { useState, FormEvent } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import toast from 'react-hot-toast';

export function LoginPage() {
  const { signIn } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'cashier'>('cashier');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Successfully logged in');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            role,
            is_active: true,
          });

        if (profileError) throw profileError;

        toast.success('Account created successfully! Please sign in.');
        setIsSignUp(false);
        setPassword('');
      }
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDEzNGg4djE0aC04eiIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden transform transition-all duration-300">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-10 text-center relative">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMCAwaDE0djE0SDB6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-10"></div>

            <div className="relative">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 shadow-lg transform transition-transform duration-300 hover:scale-110">
                {isSignUp ? (
                  <UserPlus className="w-10 h-10 text-white" />
                ) : (
                  <LogIn className="w-10 h-10 text-white" />
                )}
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Cloud POS</h1>
              <p className="text-blue-100 text-sm font-medium">
                {isSignUp ? 'Create Your Account' : 'Welcome Back'}
              </p>
            </div>
          </div>

          <div className="px-8 py-8">
            <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
              {isSignUp && (
                <div className="transform transition-all duration-300 ease-in-out">
                  <Input
                    type="text"
                    label="Full Name"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              )}
              <Input
                type="email"
                label="Email Address"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus={!isSignUp}
              />
              <Input
                type="password"
                label="Password"
                placeholder={isSignUp ? 'Create a password (min 6 characters)' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              {isSignUp && (
                <div className="transform transition-all duration-300 ease-in-out">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'manager' | 'cashier')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                  >
                    <option value="admin">Admin (Full Access)</option>
                    <option value="manager">Manager (Products & Reports)</option>
                    <option value="cashier">Cashier (Register Only)</option>
                  </select>
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 transition-all duration-200 transform hover:scale-[1.02]"
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isSignUp ? 'Creating Account...' : 'Signing in...'}
                  </span>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setPassword('');
                }}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200 hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-white/60 text-sm">
          Secure Point of Sale Management System
        </p>
      </div>
    </div>
  );
}

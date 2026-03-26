import { useState, FormEvent } from 'react';
import { LogIn, UserPlus, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';
import toast from 'react-hot-toast';

export function LoginPage() {
  const { signIn } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
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
            role: 'cashier',
            is_active: true,
            account_status: 'pending',
          });

        if (profileError) throw profileError;

        // Sign out the user immediately after signup
        await supabase.auth.signOut();

        toast.success('Account created! Waiting for admin approval.');
        setIsPending(true);
        setIsSignUp(false);
      }
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDEzNEgxNHY0aDIydi00em0wLTEwMEgxNHY0aDIyVjM0em0wIDUwSDE0djRoMjJ2LTR6bTAgNTBIMTR2NGgyMnYtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>

        <Card className="w-full max-w-md relative z-10 backdrop-blur-sm bg-white/95">
          <CardContent className="py-12 px-8 text-center">
            <div className="mb-6 flex justify-center">
              <div className="bg-yellow-100 p-4 rounded-full">
                <Clock className="w-12 h-12 text-yellow-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Account Pending Approval
            </h2>
            <p className="text-gray-600 mb-2 text-base leading-relaxed">
              Your account has been created successfully and is waiting for administrator approval.
            </p>
            <p className="text-gray-600 mb-8 text-base leading-relaxed">
              Please contact your system administrator to approve your account. You will be able to sign in once your account is approved.
            </p>
            <Button
              onClick={() => setIsPending(false)}
              variant="outline"
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDEzNEgxNHY0aDIydi00em0wLTEwMEgxNHY0aDIyVjM0em0wIDUwSDE0djRoMjJ2LTR6bTAgNTBIMTR2NGgyMnYtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>

      <Card className="w-full max-w-md relative z-10 backdrop-blur-sm bg-white/95">
        <CardHeader className="text-center pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-3 mt-2 leading-relaxed">
            Teefoods and Grainhub
          </h1>
          <p className="text-gray-600 text-base">
            {isSignUp ? 'Create your account to get started' : 'Welcome back! Sign in to continue'}
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
            {isSignUp && (
              <Input
                type="text"
                label="Full Name"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
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
            <Button
              type="submit"
              className="w-full mt-6"
              disabled={loading}
              size="lg"
            >
              {loading ? (isSignUp ? 'Creating Account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
            </Button>
          </form>

          <div className="mt-8 text-center relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or</span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setPassword('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

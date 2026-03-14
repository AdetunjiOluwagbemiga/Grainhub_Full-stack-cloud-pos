import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithPin: (pinCode: string) => Promise<void>;
  logActivity: (activityType: string, description: string, metadata?: Record<string, unknown>) => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isCashier: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        throw error;
      }

      if (!data) {
        console.warn('No profile found for user:', userId);
      } else {
        console.log('Profile loaded successfully:', { id: data.id, role: data.role, email: data.email });
      }

      setProfile(data);
    } catch (error) {
      console.error('Fatal error loading profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    await logActivity('login', 'User logged in via email/password');
  };

  const signInWithPin = async (pinCode: string) => {
    throw new Error('PIN authentication is not supported. Please use email and password.');
  };

  const signOut = async () => {
    await logActivity('logout', 'User logged out');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const logActivity = async (
    activityType: string,
    description: string,
    metadata?: Record<string, unknown>
  ) => {
    try {
      await supabase.from('activity_logs').insert({
        user_id: user?.id || null,
        activity_type: activityType as any,
        description,
        metadata: metadata || null,
        ip_address: null,
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const isCashier = profile?.role === 'cashier';

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
    signInWithPin,
    logActivity,
    isAdmin,
    isManager,
    isCashier,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

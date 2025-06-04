'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase/client';
import type { UserProfile, Organization } from '@/types';
import { useState } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

const signupSchema = z.object({
  organizationName: z.string().min(2, { message: 'Organization name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      organizationName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        // Update Firebase Auth profile (optional, but good practice)
        await updateProfile(firebaseUser, { displayName: data.email?.split('@')[0] });

        // Create Organization
        const organizationId = uuidv4();
        const organizationRef = doc(db, 'organizations', organizationId);
        const newOrganization: Organization = {
          id: organizationId,
          name: data.organizationName,
          createdAt: serverTimestamp() as Timestamp,
        };
        await setDoc(organizationRef, newOrganization);

        // Create User Profile in Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const newUserProfile: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || data.email?.split('@')[0] || 'New User',
          organizationId: organizationId,
          role: 'admin', // First user is admin
          createdAt: serverTimestamp() as Timestamp,
        };
        await setDoc(userDocRef, newUserProfile);

        toast({
          title: 'Signup Successful',
          description: 'Your account and organization have been created.',
        });
        // Auth context will handle redirect to dashboard
      } else {
        throw new Error("User creation failed.");
      }

    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: 'Signup Failed',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-center mb-2 font-headline">Create an Account</h1>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Join MaquilaNet Control to manage your network infrastructure.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="organizationName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input placeholder="Your Maquiladora's Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="your.admin@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••" 
                      {...field} 
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                 <div className="relative">
                    <Input 
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••" 
                      {...field} 
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary-foreground"></div>
            ) : (
               <> <UserPlus className="mr-2 h-4 w-4" /> Sign Up </>
            )}
          </Button>
        </form>
      </Form>
      <div className="mt-6 text-center text-sm">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </div>
    </>
  );
}

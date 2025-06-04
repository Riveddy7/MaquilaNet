'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';

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
import { auth } from '@/lib/firebase/client';
import { useState } from 'react';
import { MailQuestion } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, data.email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'Check your inbox for instructions to reset your password.',
      });
      setEmailSent(true);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      toast({
        title: 'Error Sending Email',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="text-center">
        <MailQuestion className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-2xl font-semibold mb-2 font-headline">Check Your Email</h1>
        <p className="text-muted-foreground mb-6">
          We&apos;ve sent a password reset link to the email address you provided.
        </p>
        <Button variant="outline" asChild>
          <Link href="/auth/login">Back to Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-center mb-2 font-headline">Forgot Your Password?</h1>
      <p className="text-sm text-muted-foreground text-center mb-6">
        No worries! Enter your email address and we&apos;ll send you a link to reset it.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="your@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary-foreground"></div>
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </form>
      </Form>
      <div className="mt-6 text-center text-sm">
        Remembered your password?{' '}
        <Link href="/auth/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </div>
    </>
  );
}

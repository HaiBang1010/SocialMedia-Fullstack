import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { usersApi } from '@/api';
import { applyFieldErrors } from '@/lib/apiError';
import { profileSchema, type ProfileValues } from '@/lib/validations/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { User } from '@/types/api';

interface ProfileEditFormProps {
  initialName: string;
  initialBio: string;
  onCancel: () => void;
  onSaved: (user: User) => void;
}

// Edit name + bio (PATCH /users/me). Field errors map back onto the form; the
// caller's onSaved handles store update + cache invalidation.
export function ProfileEditForm({
  initialName,
  initialBio,
  onCancel,
  onSaved,
}: ProfileEditFormProps) {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: initialName, bio: initialBio },
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileValues) => usersApi.updateMe(values),
    onSuccess: (res) => onSaved(res.user),
    onError: (err) => {
      if (applyFieldErrors(err, form.setError)) return;
      form.setError('root', {
        message: 'Something went wrong. Please try again.',
      });
    },
  });

  const onSubmit = (values: ProfileValues) => {
    form.clearErrors('root');
    mutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Input placeholder="Tell us about yourself" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

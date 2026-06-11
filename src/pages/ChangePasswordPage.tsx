import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { apiErrorMessage } from "../lib/api";
import { changePassword } from "../lib/usersApi";
import { Button, Card, Field, Input, PageHeader, useToast } from "../components/ui";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mut = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("New password and confirmation do not match");
    mut.mutate();
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader title="Change password" />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Current password">
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
          <Field label="New password" hint="min 8 characters">
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={mut.isPending}>
              Update password
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

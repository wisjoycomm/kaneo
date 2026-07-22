import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { DEFAULT_ROLE_NAMES } from "@kaneo/permissions";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useWorkspaceRoles from "@/hooks/queries/workspace/use-workspace-roles";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type Props = {
  open: boolean;
  onClose: () => void;
};

const teamMemberSchema = z.object({
  email: z.string(),
  role: z.string(),
});

type TeamMemberFormValues = z.infer<typeof teamMemberSchema>;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function InviteTeamMemberModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { mutateAsync } = useInviteWorkspaceUser();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const { data: allWorkspaceRoles = [] } = useWorkspaceRoles(workspaceId);
  const customRoles = allWorkspaceRoles.filter(
    (r) =>
      !DEFAULT_ROLE_NAMES.includes(
        r.role as (typeof DEFAULT_ROLE_NAMES)[number],
      ),
  );
  const { canInviteUsers } = useWorkspacePermission();
  const canInvite = canInviteUsers();

  const form = useForm<TeamMemberFormValues>({
    resolver: standardSchemaResolver(teamMemberSchema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });

  const onSubmit = async ({ email, role }: TeamMemberFormValues) => {
    if (!workspaceId) {
      toast.error(t("team:inviteModal.error"));
      return;
    }
    if (!canInvite) {
      // Defense-in-depth: parent gates the trigger, but if the modal is
      // somehow open without permission we refuse rather than firing a
      // mutation the server will reject.
      toast.error(t("team:inviteModal.error"));
      return;
    }
    try {
      await mutateAsync({ email, workspaceId, role });
      await queryClient.refetchQueries({
        queryKey: ["workspace-users", workspaceId],
      });

      toast.success(t("team:inviteModal.success"));

      resetInviteTeamMember();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team:inviteModal.error"),
      );
    }
  };

  const resetInviteTeamMember = async () => {
    if (workspaceId) {
      await queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });
    }
    form.reset();
  };

  const resetAndCloseModal = () => {
    resetInviteTeamMember();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{t("team:inviteModal.title")}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
            <DialogPanel>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("team:inviteModal.emailLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("team:inviteModal.emailPlaceholder")}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("team:inviteModal.roleLabel")}</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {t(`team:roles.${field.value}`, {
                              defaultValue: capitalize(field.value),
                            })}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">
                            {t("team:roles.viewer", { defaultValue: "Viewer" })}
                          </SelectItem>
                          <SelectItem value="member">
                            {t("team:roles.member", { defaultValue: "Member" })}
                          </SelectItem>
                          <SelectItem value="admin">
                            {t("team:roles.admin", { defaultValue: "Admin" })}
                          </SelectItem>
                          {customRoles.map((r) => (
                            <SelectItem key={r.id} value={r.role}>
                              {capitalize(r.role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </DialogPanel>

            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" size="sm" type="button" />}
              >
                {t("common:actions.cancel")}
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={!workspaceId || !canInvite}
              >
                {t("team:inviteModal.sendInvitation")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}

export default InviteTeamMemberModal;

import { useListBoardMembers, useInviteMember, useGetBoard, getListBoardMembersQueryKey, useRemoveBoardMember } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, UserPlus, Shield, Trash2, Mail } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function MembersView() {
  const params = useParams();
  const boardId = Number(params.boardId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: board } = useGetBoard(boardId, { query: { enabled: !!boardId }});
  const { data: members, isLoading } = useListBoardMembers(boardId, {
    query: { enabled: !!boardId, queryKey: getListBoardMembersQueryKey(boardId) }
  });
  
  const inviteMember = useInviteMember();
  const removeMember = useRemoveBoardMember();

  const [inviteUsername, setInviteUsername] = useState("");

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    
    inviteMember.mutate({
      boardId,
      data: { username: inviteUsername }
    }, {
      onSuccess: () => {
        setInviteUsername("");
        toast({ title: "Invitation sent", description: `Invited @${inviteUsername}` });
      },
      onError: (err: any) => {
        toast({ title: "Failed to invite", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleRemove = (userId: string) => {
    if (confirm("Remove this member?")) {
      removeMember.mutate({
        boardId,
        userId
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBoardMembersQueryKey(boardId) });
        }
      });
    }
  };

  if (isLoading) return <div className="p-8">Loading members...</div>;

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="px-6 py-4 border-b flex items-center bg-card shrink-0">
        <Link href={`/boards/${boardId}`}>
          <Button variant="ghost" className="-ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Board
          </Button>
        </Link>
        <h1 className="text-xl font-bold ml-4">Members of {board?.name}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-3xl mx-auto space-y-10">
          
          <section className="bg-card border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Invite People
            </h2>
            <form onSubmit={handleInvite} className="flex gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={inviteUsername}
                  onChange={e => setInviteUsername(e.target.value)}
                  placeholder="Enter username to invite..."
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={!inviteUsername.trim() || inviteMember.isPending}>
                Send Invite
              </Button>
            </form>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4">Board Members ({members?.length || 0})</h2>
            <div className="space-y-3">
              {members?.map(member => (
                <div key={member.id} className="flex items-center justify-between p-4 bg-card border rounded-xl shadow-sm">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={member.profileImage || ""} />
                      <AvatarFallback>{member.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.firstName} {member.lastName}</p>
                      <p className="text-sm text-muted-foreground">@{member.username}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      {member.role === "owner" && <Shield className="w-3.5 h-3.5" />}
                      <span className="capitalize">{member.role}</span>
                    </div>
                    
                    {member.role !== "owner" && (
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemove(member.userId)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

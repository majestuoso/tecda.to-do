import { useListBoards, useListMyInvitations, useAcceptInvitation, useDeclineInvitation, useCreateBoard } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Check, X, Bell } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListBoardsQueryKey, getListMyInvitationsQueryKey } from "@workspace/api-client-react";

const COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Yellow
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Violet
];

export function Dashboard() {
  const { data: boards, isLoading } = useListBoards();
  const { data: invitations } = useListMyInvitations();
  const createBoard = useCreateBoard();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [newBoardColor, setNewBoardColor] = useState(COLORS[0]);

  const handleCreate = () => {
    if (!newBoardName) return;
    createBoard.mutate({
      data: {
        name: newBoardName,
        description: newBoardDesc,
        color: newBoardColor
      }
    }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setNewBoardName("");
        setNewBoardDesc("");
        queryClient.invalidateQueries({ queryKey: getListBoardsQueryKey() });
      }
    });
  };

  const handleAccept = (id: number) => {
    acceptInvitation.mutate({ invitationId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMyInvitationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBoardsQueryKey() });
      }
    });
  };

  const handleDecline = (id: number) => {
    declineInvitation.mutate({ invitationId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMyInvitationsQueryKey() });
      }
    });
  };

  const pendingInvitations = invitations?.filter(i => i.status === "pending") || [];

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto w-full space-y-10 animate-in fade-in duration-500">
      
      {pendingInvitations.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4 text-amber-600 font-medium">
            <Bell className="w-5 h-5" />
            <h2 className="text-lg">Pending Invitations</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingInvitations.map(inv => (
              <Card key={inv.id} className="border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{inv.boardName}</CardTitle>
                  <CardDescription>Invited by @{inv.invitedByUsername}</CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-end gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => handleDecline(inv.id)}>
                    <X className="w-4 h-4 mr-1" /> Decline
                  </Button>
                  <Button size="sm" onClick={() => handleAccept(inv.id)}>
                    <Check className="w-4 h-4 mr-1" /> Accept
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Your Boards</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> New Board
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new board</DialogTitle>
                <DialogDescription>Setup a new workspace for your team.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input 
                    value={newBoardName} 
                    onChange={e => setNewBoardName(e.target.value)} 
                    placeholder="E.g., Q3 Roadmap"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (optional)</label>
                  <Input 
                    value={newBoardDesc} 
                    onChange={e => setNewBoardDesc(e.target.value)} 
                    placeholder="What is this board for?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Theme Color</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewBoardColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${newBoardColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!newBoardName || createBoard.isPending}>
                  {createBoard.isPending ? "Creating..." : "Create Board"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {boards?.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed">
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No boards yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first board to get started.</p>
            <Button onClick={() => setIsCreateOpen(true)} variant="outline">Create Board</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boards?.map(board => (
              <Link key={board.id} href={`/boards/${board.id}`}>
                <Card className="hover-elevate cursor-pointer transition-all border-border hover:border-primary/50 overflow-hidden h-full flex flex-col group">
                  <div className="h-3 w-full transition-all group-hover:h-4" style={{ backgroundColor: board.color }} />
                  <CardHeader className="flex-1">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{board.name}</CardTitle>
                    {board.description && (
                      <CardDescription className="line-clamp-2 mt-2">{board.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardFooter className="pt-4 border-t bg-muted/20 flex justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{board.cardCount} cards</span>
                    <span>{board.memberCount} members</span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

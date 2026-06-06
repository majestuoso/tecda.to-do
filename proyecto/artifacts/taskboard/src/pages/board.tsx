import { useGetBoard, useUpdateCard, useCreateCard, getGetBoardQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Settings, AlignLeft, Paperclip, Calendar, MoreHorizontal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CardInputStatus } from "@workspace/api-zod/src/generated/types/cardInputStatus";

export function BoardView() {
  const params = useParams();
  const boardId = Number(params.boardId);
  const queryClient = useQueryClient();
  
  const { data: board, isLoading } = useGetBoard(boardId, { 
    query: { enabled: !!boardId, queryKey: getGetBoardQueryKey(boardId) } 
  });
  
  const updateCard = useUpdateCard();
  const createCard = useCreateCard();

  const [isAddingCard, setIsAddingCard] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  const handleDragStart = (e: React.DragEvent, cardId: number) => {
    e.dataTransfer.setData("cardId", cardId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: "todo" | "in_progress" | "done") => {
    e.preventDefault();
    const cardIdStr = e.dataTransfer.getData("cardId");
    if (!cardIdStr) return;
    const cardId = parseInt(cardIdStr, 10);
    
    // Find card
    const card = board?.cards.find(c => c.id === cardId);
    if (!card || card.status === status) return;

    // Optimistic update could go here
    updateCard.mutate({
      cardId,
      data: { status }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBoardQueryKey(boardId) });
      }
    });
  };

  const handleCreateCard = (status: "todo" | "in_progress" | "done") => {
    if (!newCardTitle.trim()) {
      setIsAddingCard(null);
      return;
    }
    createCard.mutate({
      boardId,
      data: { title: newCardTitle, status }
    }, {
      onSuccess: () => {
        setNewCardTitle("");
        setIsAddingCard(null);
        queryClient.invalidateQueries({ queryKey: getGetBoardQueryKey(boardId) });
      }
    });
  };

  if (isLoading) return <div className="p-8">Loading board...</div>;
  if (!board) return <div className="p-8 text-destructive">Board not found</div>;

  const columns = [
    { id: "todo" as const, title: "To Do" },
    { id: "in_progress" as const, title: "In Progress" },
    { id: "done" as const, title: "Done" }
  ];

  return (
    <div className="flex flex-col h-full flex-1 overflow-hidden bg-muted/10">
      {/* Board Header */}
      <header className="px-6 py-4 border-b bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: board.color }} />
          <h1 className="text-2xl font-bold tracking-tight">{board.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/boards/${board.id}/members`}>
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              Members ({board.members.length})
            </Button>
          </Link>
        </div>
      </header>

      {/* Board Canvas */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-6 h-full items-start">
          {columns.map(col => {
            const columnCards = board.cards.filter(c => c.status === col.id).sort((a, b) => a.position - b.position);
            
            return (
              <div 
                key={col.id}
                className="w-80 shrink-0 flex flex-col bg-muted/40 rounded-xl border border-border/50 max-h-full"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between sticky top-0 bg-muted/40 backdrop-blur z-10 rounded-t-xl">
                  <h3 className="font-medium text-sm text-foreground/80 flex items-center gap-2">
                    {col.title}
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {columnCards.length}
                    </span>
                  </h3>
                </div>
                
                <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-3 min-h-[150px]">
                  {columnCards.map(card => (
                    <Link key={card.id} href={`/boards/${board.id}/card/${card.id}`}>
                      <div 
                        draggable
                        onDragStart={(e) => handleDragStart(e, card.id)}
                        className="bg-card p-3 rounded-lg border shadow-sm hover:shadow hover-elevate cursor-pointer transition-all group"
                      >
                        <p className="font-medium text-sm mb-2 group-hover:text-primary transition-colors line-clamp-2">{card.title}</p>
                        
                        {(card.description || card.attachmentCount > 0 || card.dueDate) && (
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-3">
                            {card.description && <AlignLeft className="w-3.5 h-3.5" />}
                            {card.attachmentCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Paperclip className="w-3.5 h-3.5" /> {card.attachmentCount}
                              </span>
                            )}
                            {card.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" /> 
                                {new Date(card.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                  
                  {isAddingCard === col.id ? (
                    <div className="bg-card p-3 rounded-lg border shadow-sm space-y-3">
                      <Input 
                        autoFocus
                        placeholder="Card title..."
                        value={newCardTitle}
                        onChange={e => setNewCardTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleCreateCard(col.id);
                          if (e.key === "Escape") {
                            setIsAddingCard(null);
                            setNewCardTitle("");
                          }
                        }}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setIsAddingCard(null);
                          setNewCardTitle("");
                        }}>Cancel</Button>
                        <Button size="sm" onClick={() => handleCreateCard(col.id)}>Add</Button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsAddingCard(col.id)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 p-2 rounded-lg transition-colors w-full justify-start"
                    >
                      <Plus className="w-4 h-4" /> Add Card
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2, Check } from "lucide-react"
import { useState, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type TaskItemProps = {
    task: {
        id: string
        name: string
        points: number
        isOptional: boolean
    }
    onUpdate: (id: string, updates: { name?: string; points?: number; isOptional?: boolean }) => void
    onDelete: (id: string) => void
}

export function TaskItem({ task, onUpdate, onDelete }: TaskItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    }

    const [isEditingName, setIsEditingName] = useState(false)
    const [name, setName] = useState(task.name)
    const nameInputRef = useRef<HTMLInputElement>(null)

    const handleNameSubmit = () => {
        setIsEditingName(false)
        if (name !== task.name) {
            onUpdate(task.id, { name })
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleNameSubmit()
        }
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 p-3 transition-colors hover:bg-slate-900/60",
                isDragging && "bg-slate-800/60"
            )}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab text-slate-500 hover:text-slate-300 active:cursor-grabbing"
            >
                <GripVertical className="size-5" />
            </div>

            <div className="flex flex-1 items-center gap-3 overflow-hidden">
                <div className="flex-1 min-w-0">
                    {isEditingName ? (
                        <Input
                            ref={nameInputRef}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleNameSubmit}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="h-8 bg-slate-950/50 text-sm"
                        />
                    ) : (
                        <span
                            onClick={() => setIsEditingName(true)}
                            className="block cursor-text truncate text-sm font-medium text-slate-200 hover:text-white hover:underline hover:decoration-slate-600 hover:underline-offset-4"
                        >
                            {task.name}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Opcjonalne</span>
                        <Switch
                            checked={task.isOptional}
                            onCheckedChange={(checked) => onUpdate(task.id, { isOptional: checked })}
                            className="scale-75 data-[state=checked]:bg-emerald-600"
                        />
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 border-slate-700/50 bg-slate-800/30 px-2 text-xs font-medium text-amber-400 hover:bg-slate-800/50 hover:text-amber-300"
                            >
                                {task.points} pkt
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-2" align="end">
                            <div className="grid grid-cols-3 gap-2">
                                {[5, 10, 15, 20, 25, 30].map((value) => (
                                    <Button
                                        key={value}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onUpdate(task.id, { points: value })}
                                        className={cn(
                                            "h-8 w-full text-xs",
                                            task.points === value && "bg-slate-100 text-slate-900"
                                        )}
                                    >
                                        {value}
                                    </Button>
                                ))}
                            </div>
                            <div className="mt-2 border-t pt-2">
                                <Input
                                    type="number"
                                    placeholder="Inna"
                                    className="h-7 text-xs"
                                    onBlur={(e) => {
                                        const val = parseInt(e.target.value)
                                        if (!isNaN(val) && val >= 0) onUpdate(task.id, { points: val })
                                    }}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => onDelete(task.id)}
                    >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Usuń zadanie</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}

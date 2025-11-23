"use client"

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useState, useTransition, useActionState, useEffect, useRef } from "react"
import { Plus } from "lucide-react"

import { TaskItem } from "./task-item"
import { reorderTasksAction, updateTaskAction, createTaskAction, deleteTaskAction } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Task = {
    id: string
    name: string
    points: number
    position: number
    isOptional: boolean
    isActive: boolean
}

type RoutineEditorProps = {
    routine: {
        id: string
        name: string
        routineType: string
        startTime: string | null
        endTime: string | null
        isActive: boolean
    }
    tasks: Task[]
}

const ROUTINE_TYPE_LABEL: Record<string, string> = {
    morning: "Poranna",
    afternoon: "Popołudniowa",
    evening: "Wieczorna",
}

export function RoutineEditor({ routine, tasks: initialTasks }: RoutineEditorProps) {
    const [tasks, setTasks] = useState(initialTasks)
    const [isPending, startTransition] = useTransition()

    // Sync local state with props when server revalidates
    useEffect(() => {
        setTasks(initialTasks)
    }, [initialTasks])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event

        if (over && active.id !== over.id) {
            // Calculate new items first
            const oldIndex = tasks.findIndex((item) => item.id === active.id)
            const newIndex = tasks.findIndex((item) => item.id === over.id)

            if (oldIndex === -1 || newIndex === -1) return

            const newItems = arrayMove(tasks, oldIndex, newIndex)

            // Update positions based on new index
            const updatedItems = newItems.map((item, index) => ({
                ...item,
                position: index + 1
            }))

            // Optimistic update
            setTasks(updatedItems)

            // Call server action
            const updates = updatedItems.map(t => ({ id: t.id, position: t.position }))
            const formData = new FormData()
            formData.append("routineId", routine.id)
            formData.append("items", JSON.stringify(updates))

            startTransition(async () => {
                await reorderTasksAction({ status: "idle" }, formData)
            })
        }
    }

    function handleUpdateTask(taskId: string, updates: { name?: string; points?: number; isOptional?: boolean }) {
        setTasks((currentTasks) =>
            currentTasks.map((task) =>
                task.id === taskId ? { ...task, ...updates } : task
            )
        )

        const formData = new FormData()
        formData.append("routineId", routine.id)
        formData.append("taskId", taskId)

        if (updates.name !== undefined) formData.append("name", updates.name)
        if (updates.points !== undefined) formData.append("points", updates.points.toString())
        if (updates.isOptional !== undefined) formData.append("isOptional", updates.isOptional.toString())

        startTransition(async () => {
            await updateTaskAction({ status: "idle" }, formData)
        })
    }

    function handleDeleteTask(taskId: string) {
        setTasks((currentTasks) => currentTasks.filter((t) => t.id !== taskId))

        const formData = new FormData()
        formData.append("routineId", routine.id)
        formData.append("taskId", taskId)

        startTransition(async () => {
            await deleteTaskAction({ status: "idle" }, formData)
        })
    }

    return (
        <Card className="border-slate-800/60 bg-slate-900/40 text-slate-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-semibold">{routine.name}</CardTitle>
                        <Badge variant="outline" className="border-slate-700/60 bg-slate-800/40 text-xs text-slate-400">
                            {ROUTINE_TYPE_LABEL[routine.routineType] ?? routine.routineType}
                        </Badge>
                    </div>
                    <CardDescription className="text-xs text-slate-400">
                        {routine.startTime && routine.endTime
                            ? `${routine.startTime.slice(0, 5)} – ${routine.endTime.slice(0, 5)}`
                            : "Brak ustalonych godzin"}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                            {tasks.map((task) => (
                                <TaskItem
                                    key={task.id}
                                    task={task}
                                    onUpdate={handleUpdateTask}
                                    onDelete={handleDeleteTask}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

                <CreateTaskForm routineId={routine.id} />

                {tasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-slate-500">
                        <p>Brak zadań w tej rutynie</p>
                        <p className="text-xs">Dodaj pierwsze zadanie powyżej</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function CreateTaskForm({ routineId }: { routineId: string }) {
    const [state, formAction] = (useActionState as any)(createTaskAction, { status: "idle" })
    const formRef = useRef<HTMLFormElement>(null)
    const [points, setPoints] = useState(10)

    useEffect(() => {
        if (state.status === "success") {
            formRef.current?.reset()
            setPoints(10)
        }
    }, [state.status])

    return (
        <form ref={formRef} action={formAction} className="mt-4 flex gap-2">
            <input type="hidden" name="routineId" value={routineId} />
            <input type="hidden" name="points" value={points} />

            <div className="flex-1">
                <Input
                    name="name"
                    placeholder="Dodaj nowe zadanie..."
                    className="bg-slate-900/50 border-slate-800 text-slate-200 placeholder:text-slate-500"
                />
            </div>

            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 w-[70px] gap-1 border-slate-800 bg-slate-900/50 px-2 text-xs font-medium text-amber-400 hover:bg-slate-800/50 hover:text-amber-300"
                    >
                        {points} pkt
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2" align="end">
                    <div className="grid grid-cols-3 gap-2">
                        {[5, 10, 15, 20, 25, 30].map((value) => (
                            <Button
                                key={value}
                                variant="ghost"
                                size="sm"
                                onClick={() => setPoints(value)}
                                className={cn(
                                    "h-8 w-full text-xs",
                                    points === value && "bg-slate-100 text-slate-900"
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
                            onChange={(e) => {
                                const val = parseInt(e.target.value)
                                if (!isNaN(val) && val >= 0) setPoints(val)
                            }}
                        />
                    </div>
                </PopoverContent>
            </Popover>

            <Button type="submit" size="icon" variant="secondary" className="shrink-0">
                <Plus className="size-4" />
                <span className="sr-only">Dodaj zadanie</span>
            </Button>
        </form>
    )
}

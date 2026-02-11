"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  registrationAdminSchema,
  type RegistrationAdminFormData,
} from "@/lib/validations/registration";
import type { Class, Teacher } from "@/types";
import { LOCATIONS, TUITION_TABLE } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RegistrationAdminFormData) => Promise<void>;
  grade?: string | null;
  classes: Class[];
  teachers: Teacher[];
}

export function RegistrationForm({
  open,
  onOpenChange,
  onSubmit,
  grade,
  classes,
  teachers,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultTuition = TUITION_TABLE[grade || ""] || 0;

  const form = useForm<RegistrationAdminFormData>({
    resolver: zodResolver(registrationAdminSchema) as never,
    defaultValues: {
      registration_date: new Date().toISOString().slice(0, 10),
      assigned_class: "",
      teacher: "",
      use_vehicle: "미사용",
      test_score: "",
      test_note: "",
      location: "",
      consult_date: "",
      additional_note: "",
      tuition_fee: defaultTuition,
    },
  });

  const handleSubmit = async (data: RegistrationAdminFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>등록 안내문 생성</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="registration_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>등록 예정일 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tuition_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>월 수업료</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="350000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assigned_class"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>배정반 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="반 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="teacher"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>담임 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="선생님 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.name}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="use_vehicle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>차량 이용</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "미사용"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="미사용">미사용</SelectItem>
                        <SelectItem value="등원">등원</SelectItem>
                        <SelectItem value="하원">하원</SelectItem>
                        <SelectItem value="등하원">등하원</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>수업 장소</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="장소 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="test_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>테스트 점수</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 85점" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consult_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학부모 상담 예정일</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="test_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>테스트 특이사항</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="테스트 관련 특이사항..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additional_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>추가 조치사항</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="추가 조치사항..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  "안내문 생성"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

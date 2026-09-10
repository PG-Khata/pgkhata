"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BlogPost } from "@/types";

export function useAdminBlogPosts() {
  return useQuery({
    queryKey: ["admin", "blog"],
    queryFn: () => api.get<BlogPost[]>("/v1/admin/blog/posts"),
  });
}

export function useAdminBlogPost(postId: string) {
  return useQuery({
    queryKey: ["admin", "blog", postId],
    queryFn: () => api.get<BlogPost>(`/v1/admin/blog/posts/${postId}`),
    enabled: !!postId,
  });
}

export function useCreateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BlogPost>) =>
      api.post<BlogPost>("/v1/admin/blog/posts", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
  });
}

export function useUpdateBlogPost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BlogPost>) =>
      api.put<BlogPost>(`/v1/admin/blog/posts/${postId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
  });
}

export function useDeleteBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) =>
      api.delete(`/v1/admin/blog/posts/${postId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
  });
}

export function useTogglePublishBlogPost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch<BlogPost>(`/v1/admin/blog/posts/${postId}/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
  });
}

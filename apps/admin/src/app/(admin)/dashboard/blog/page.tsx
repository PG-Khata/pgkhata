"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminBlogPosts, useDeleteBlogPost, useTogglePublishBlogPost } from "@/hooks/use-admin-blog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Search, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function BlogPage() {
  const { data: posts, isLoading } = useAdminBlogPosts();
  const deletePost = useDeleteBlogPost();
  const [search, setSearch] = useState("");

  const filtered = (posts ?? []).filter((p) => {
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
  });

  function handleDelete(postId: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    deletePost.mutate(postId, {
      onSuccess: () => toast.success("Post deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Blog</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Create and manage blog posts for pgkhata.com.</p>
        </div>
        <Link href="/dashboard/blog/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            New Post
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by title or slug..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((post) => (
            <ToggleablePost key={post.id} post={post} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No blog posts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create your first post to get started.</p>
        </div>
      )}
    </div>
  );
}

function ToggleablePost({
  post,
  onDelete,
}: {
  post: { id: string; title: string; slug: string; published: boolean; publishedAt: string | null; updatedAt: string };
  onDelete: (id: string, title: string) => void;
}) {
  const togglePublish = useTogglePublishBlogPost(post.id);

  function handleToggle() {
    togglePublish.mutate(undefined, {
      onSuccess: () => toast.success(post.published ? "Unpublished" : "Published"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  }

  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-xs">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{post.title}</p>
          <Badge variant={post.published ? "default" : "secondary"}>
            {post.published ? "Published" : "Draft"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">/blog/{post.slug}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Updated {new Date(post.updatedAt).toLocaleDateString("en-IN")}
          {post.publishedAt && ` · Published ${new Date(post.publishedAt).toLocaleDateString("en-IN")}`}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <Button variant="outline" size="sm" onClick={handleToggle} disabled={togglePublish.isPending}>
          {post.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Link href={`/dashboard/blog/${post.id}`}>
          <Button variant="outline" size="sm">Edit</Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={() => onDelete(post.id, post.title)} className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

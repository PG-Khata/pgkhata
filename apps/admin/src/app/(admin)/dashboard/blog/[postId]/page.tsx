"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminBlogPost, useUpdateBlogPost, useCreateBlogPost } from "@/hooks/use-admin-blog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { toast } from "sonner";
import type { BlogPost } from "@/types";

export default function BlogEditorPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const isNew = postId === "new";

  const { data: existingPost, isLoading } = useAdminBlogPost(isNew ? "" : postId);

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Keyed on postId so switching posts remounts the form with fresh initial values.
  return <BlogEditorForm key={postId} postId={postId} isNew={isNew} post={existingPost} />;
}

function BlogEditorForm({
  postId,
  isNew,
  post,
}: {
  postId: string;
  isNew: boolean;
  post: BlogPost | undefined;
}) {
  const router = useRouter();
  const createPost = useCreateBlogPost();
  const updatePost = useUpdateBlogPost(isNew ? "" : postId);

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [tags, setTags] = useState((post?.tags ?? []).join(", "));
  const [author, setAuthor] = useState(post?.author ?? "Mukund Jha");

  function generateSlug() {
    setSlug(
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }

  function handleSave(publish: boolean) {
    const data = {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      author,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      published: publish,
    };

    if (isNew) {
      createPost.mutate(data, {
        onSuccess: () => {
          toast.success(publish ? "Post published" : "Draft saved");
          router.push("/dashboard/blog");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
      });
    } else {
      updatePost.mutate(data, {
        onSuccess: () => {
          toast.success(publish ? "Post published" : "Draft saved");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
      });
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/blog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Blog
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold tracking-tight">
          {isNew ? "New Blog Post" : "Edit Blog Post"}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={createPost.isPending || updatePost.isPending}>
            <Save className="mr-1.5 h-4 w-4" /> Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={createPost.isPending || updatePost.isPending}>
            <Eye className="mr-1.5 h-4 w-4" /> Publish
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to Reduce Rent Follow-Up Time" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Slug
            <button type="button" onClick={generateSlug} className="ml-2 text-xs text-primary hover:underline">
              Generate from title
            </button>
          </label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="how-to-reduce-rent-followup-time" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Excerpt</label>
          <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="5 practical tips to cut your monthly rent collection time in half." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Author</label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Tags (comma separated)</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="billing, tips, operations" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Content (MDX)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your blog post content here using Markdown/MDX..."
            className="min-h-[400px] w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}

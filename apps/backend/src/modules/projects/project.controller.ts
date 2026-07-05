import type { Request, Response } from 'express';
import { ok, created, paginationMeta } from '@/utils/response';
import * as projectService from './project.service';

export async function createProject(req: Request, res: Response): Promise<void> {
  const project = await projectService.createProject(req.workspace!.id, req.user!.id, req.body);
  created(res, project);
}

export async function listProjects(req: Request, res: Response): Promise<void> {
  const query = req.query as never;
  const { projects, total } = await projectService.listProjects(req.workspace!.id, req.user!.id, query);
  const { page, limit } = query as { page: number; limit: number };
  ok(res, projects, paginationMeta(page, limit, total));
}

export async function getProject(req: Request, res: Response): Promise<void> {
  ok(res, await projectService.getProject(req.workspace!.id, req.params.projectId, req.user!.id));
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  ok(res, await projectService.updateProject(req.workspace!.id, req.params.projectId, req.user!.id, req.body));
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  await projectService.deleteProject(req.workspace!.id, req.params.projectId, req.user!.id);
  ok(res, null);
}

export async function toggleFavorite(req: Request, res: Response): Promise<void> {
  ok(res, await projectService.toggleFavorite(req.workspace!.id, req.params.projectId, req.user!.id));
}

export async function duplicateProject(req: Request, res: Response): Promise<void> {
  const project = await projectService.duplicateProject(
    req.workspace!.id,
    req.params.projectId,
    req.user!.id,
    req.body
  );
  created(res, project);
}

export async function refreshHealth(req: Request, res: Response): Promise<void> {
  ok(res, await projectService.refreshProjectHealth(req.workspace!.id, req.params.projectId));
}

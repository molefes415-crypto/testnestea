import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { automationSchema } from './news-automation';
const token=z.string().min(1).max(4096);
export const readNewsSchedules=createServerFn({method:'POST'}).inputValidator(data=>z.object({token}).parse(data)).handler(async({data})=>{const {listAutomation}=await import('./news-automation.server');return listAutomation(data.token);});
export const armNewsSchedule=createServerFn({method:'POST'}).inputValidator(data=>z.object({token,input:automationSchema}).parse(data)).handler(async({data})=>{const {scheduleAutomation}=await import('./news-automation.server');return scheduleAutomation(data.token,data.input);});
export const cancelNewsSchedule=createServerFn({method:'POST'}).inputValidator(data=>z.object({token,id:z.string().uuid()}).parse(data)).handler(async({data})=>{const {cancelAutomation}=await import('./news-automation.server');return cancelAutomation(data.token,data.id);});
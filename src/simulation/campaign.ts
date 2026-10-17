import type { LocationId } from './types';
export type InquiryDay = 1 | 2 | 3;
export type ObjectiveId = 'records' | 'first-household' | 'sample' | 'water-routines' | 'workhouse' | 'brewery' | 'nonlocal' | 'walking-access';
export interface DayDefinition {
  day: InquiryDay; date: string; title: string; previousDate: string; previousDeaths: number;
  objectives: readonly { id: ObjectiveId; title: string; location: LocationId; evidence: string }[];
}
export const historicalSource = 'https://www.academia.dk/MedHist/Biblioteket/Print/snow_1855.html';
export const inquiryOpening = 'Cholera is spreading through Soho. Help Dr. John Snow discover its source.';
export const chronologyNote = 'This dramatization condenses the investigation into three days, with reconstructed dialogue, households and settings.';
export const days: readonly DayDefinition[] = [
 {day:1,date:'September 5, 1854',title:'Establish the pattern',previousDate:'September 4',previousDeaths:71,objectives:[
  {id:'records',title:'Copy the registrar’s records',location:'registrar',evidence:'attack-timeline'},
  {id:'first-household',title:'Interview Household 1',location:'household',evidence:'household-exposure'}]},
 {day:2,date:'September 6, 1854',title:'Test the explanation',previousDate:'September 5',previousDeaths:45,objectives:[
  {id:'sample',title:'Inspect the pump water',location:'broad-street',evidence:'pump-water-inspection'},
  {id:'water-routines',title:'Interview Household 2',location:'household-routines',evidence:'household-water-pattern'},
  {id:'workhouse',title:'Investigate the workhouse exception',location:'workhouse',evidence:'workhouse-exception'}]},
 {day:3,date:'September 7, 1854',title:'Explain the exceptions',previousDate:'September 6',previousDeaths:37,objectives:[
  {id:'walking-access',title:'Compare Snow’s walking measurements at the map table',location:'snow-desk',evidence:'walking-access'},
  {id:'brewery',title:'Interview the brewery owners',location:'brewery',evidence:'brewery-exception'},
  {id:'nonlocal',title:'Interview Household 3',location:'household-away',evidence:'nonlocal-exposure'}]},
];
export const locationDay: Partial<Record<LocationId, InquiryDay>> = {'household-routines':2,workhouse:2,brewery:3,'household-away':3};
export function dayDefinition(day: InquiryDay): DayDefinition { return days[day-1]; }
/** Authored morning report; the historical figures remain centralized in the day definitions. */
export function snowMorningReport(day: InquiryDay): string {
 return `I have checked with the registrar${day>1?' again':''}: ${dayDefinition(day).previousDeaths} cholera deaths yesterday among people from the streets around Broad Street.`;
}

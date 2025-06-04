'use server';
/**
 * @fileOverview This file defines the Genkit flow for processing RFID census data.
 *
 * - processRfidCensus - A function that processes the RFID census.
 * - ProcessRfidCensusInput - The input type for the processRfidCensus function.
 * - ProcessRfidCensusOutput - The return type for the processRfidCensus function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProcessRfidCensusInputSchema = z.object({
  ubicacionId: z.string().describe('The ID of the IDF/MDF location being censused.'),
  rfidTagsLeidos: z.array(z.string()).describe('An array of RFID tag IDs read by the portable reader.'),
});
export type ProcessRfidCensusInput = z.infer<typeof ProcessRfidCensusInputSchema>;

const RfidCensusDiscrepancySchema = z.object({
  tipo: z.enum(['FALTANTE', 'NO_REGISTRADO']).describe('The type of discrepancy.'),
  equipoId: z.string().optional().describe('The ID of the equipment, if missing.'),
  rfidTagId: z.string().optional().describe('The RFID tag ID, if unregistered.'),
});

const ProcessRfidCensusOutputSchema = z.object({
  discrepancias: z.array(RfidCensusDiscrepancySchema).describe('An array of discrepancies found during the census.'),
  faltantesCount: z.number().describe('The number of missing equipments'),
  noRegistradosCount: z.number().describe('The number of unregistered RFID tags'),
});

export type ProcessRfidCensusOutput = z.infer<typeof ProcessRfidCensusOutputSchema>;

export async function processRfidCensus(input: ProcessRfidCensusInput): Promise<ProcessRfidCensusOutput> {
  return processRfidCensusFlow(input);
}

const processRfidCensusFlow = ai.defineFlow(
  {
    name: 'processRfidCensusFlow',
    inputSchema: ProcessRfidCensusInputSchema,
    outputSchema: ProcessRfidCensusOutputSchema,
  },
  async input => {
    // Here we would call the Firebase function to process the census data.
    // This is a placeholder implementation.
    const discrepancies: RfidCensusDiscrepancySchema[] = [];
    let faltantesCount:number = 0
    let noRegistradosCount:number = 0

    // Simulate some discrepancies for demonstration purposes.
    if (input.rfidTagsLeidos.length > 0) {
      discrepancies.push({
        tipo: 'NO_REGISTRADO',
        rfidTagId: input.rfidTagsLeidos[0],
      });
      noRegistradosCount = 1
    }
    
    // Simulate a missing equipment
    if (input.ubicacionId === 'ubicacion123') {
      discrepancies.push({
        tipo: 'FALTANTE',
        equipoId: 'equipo456',
      });
      faltantesCount = 1
    }

    return {
      discrepancias: discrepancies,
      faltantesCount: faltantesCount,
      noRegistradosCount: noRegistradosCount
    };
  }
);

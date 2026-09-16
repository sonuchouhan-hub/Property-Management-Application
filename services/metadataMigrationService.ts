import { db, sanitizeData } from './firebaseService';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Project, Plot } from '../types';
import {
  standardizeProjectPlots,
  applyVrindavanDreamCityOfficialSizes,
  applyMaaGinniViharOfficialSizes,
  applyDivineParkOfficialSizes,
  applyMaaGinniViharExtensionOfficialSizes,
  applyMaaGinniParkOfficialSizes,
  applyShantiViharOfficialSizes,
  applyRedwoodPlatinumOfficialSizes,
  applyRedwoodPlatinumExtensionOfficialSizes,
  applyShrinathDreamCityOfficialSizes,
  applyMeeraGovindParkOfficialSizes,
  applyShivajiParkOfficialSizes,
  applyShriKeshvamCorridorOfficialSizes,
  applyMeeraValleyOfficialSizes
} from '../constants';

const cleanProjectMetadata = (p: Project): Project => {
  const standardized = standardizeProjectPlots(p);
  return applyVrindavanDreamCityOfficialSizes(
    applyMaaGinniViharOfficialSizes(
      applyDivineParkOfficialSizes(
        applyMaaGinniViharExtensionOfficialSizes(
          applyMaaGinniParkOfficialSizes(
            applyShantiViharOfficialSizes(
              applyRedwoodPlatinumOfficialSizes(
                applyRedwoodPlatinumExtensionOfficialSizes(
                  applyShrinathDreamCityOfficialSizes(
                    applyMeeraGovindParkOfficialSizes(
                      applyShivajiParkOfficialSizes(
                        applyShriKeshvamCorridorOfficialSizes(
                          applyMeeraValleyOfficialSizes(standardized)
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );
};

export async function runFirestorePlotMetadataMigration(): Promise<void> {
  const MIGRATION_KEY = 'dhanshri_plot_metadata_migration_v5_ews';
  if (typeof window !== 'undefined' && localStorage.getItem(MIGRATION_KEY) === 'completed') {
    return;
  }

  try {
    const projectsSnapshot = await getDocs(collection(db, 'projects'));
    if (projectsSnapshot.empty) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(MIGRATION_KEY, 'completed');
      }
      return;
    }

    for (const docSnap of projectsSnapshot.docs) {
      const projectDocId = docSnap.id;
      const rawProject = docSnap.data() as Project;

      if (!rawProject || (!rawProject.plots && !rawProject.layout)) {
        continue;
      }

      const updatedMetadataProject = cleanProjectMetadata(rawProject);

      const existingPlots = rawProject.plots || rawProject.layout || [];
      const updatedMetadataPlots = updatedMetadataProject.plots || updatedMetadataProject.layout || [];

      // Create lookup map by plot number / ID
      const newMetadataMap = new Map<string | number, Plot>();
      updatedMetadataPlots.forEach(p => {
        newMetadataMap.set(p.id, p);
        const numClean = p.number ? p.number.replace(/^[Pp]-/, '') : '';
        if (numClean) {
          newMetadataMap.set(numClean, p);
          newMetadataMap.set(`P-${numClean}`, p);
        }
      });

      // Merge metadata onto existing plots while preserving ALL existing IDs, status, bookings, CRM, customer data
      const mergedPlots = existingPlots.map(existingPlot => {
        const numClean = existingPlot.number ? existingPlot.number.replace(/^[Pp]-/, '') : '';
        const metaPlot = 
          newMetadataMap.get(existingPlot.id) || 
          newMetadataMap.get(existingPlot.number) || 
          newMetadataMap.get(numClean);

        const targetCat = metaPlot?.category ?? existingPlot.category;
        const finalCategory = (targetCat === 'EWA' || existingPlot.category === 'EWA') ? 'EWS' : targetCat;

        const targetType = metaPlot?.type ?? existingPlot.type;
        const finalType = (targetType === ('EWA' as any) || (existingPlot.type as any) === 'EWA') ? 'EWS' as any : targetType;

        if (!metaPlot) {
          return {
            ...existingPlot,
            category: finalCategory,
            type: finalType,
          };
        }

        return {
          ...existingPlot,
          dimensions: metaPlot.dimensions ?? existingPlot.dimensions,
          size: metaPlot.size !== undefined && metaPlot.size !== 0 ? metaPlot.size : existingPlot.size,
          width: metaPlot.width !== undefined ? metaPlot.width : existingPlot.width,
          length: metaPlot.length !== undefined ? metaPlot.length : existingPlot.length,
          plotSizeLabel: metaPlot.plotSizeLabel ?? existingPlot.plotSizeLabel,
          type: finalType,
          category: finalCategory,
          specialType: metaPlot.specialType ?? existingPlot.specialType,
          remarks: metaPlot.remarks ?? existingPlot.remarks,
          isMortgaged: metaPlot.isMortgaged !== undefined ? metaPlot.isMortgaged : existingPlot.isMortgaged,
        };
      });

      // Update Firestore document preserving every existing field
      await updateDoc(doc(db, 'projects', projectDocId), sanitizeData({
        plots: mergedPlots,
        layout: mergedPlots,
      }));
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MIGRATION_KEY, 'completed');
      } catch {}
    }
    console.log('✅ Firestore Plot Metadata Migration Completed Successfully.');
  } catch (err) {
    console.warn('⚠️ Plot Metadata Migration Deferred/Failed:', err);
  }
}

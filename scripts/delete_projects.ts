import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  listAll,
  deleteObject
} from 'firebase/storage';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = getApps().length === 0 ? initializeApp(config) : getApp();
const db = getFirestore(app, config.firestoreDatabaseId);
const storage = getStorage(app);

const TARGET_PROJECT_NAMES = [
  'Shivaji Park',
  'Shri Keshvam Corridor',
  'Shree Keshvam Corridor',
  'Redwood Premium'
];

const TARGET_PROJECT_IDS = [2, 8, 12]; // 2: Keshvam, 8: Shivaji Park, 12: Redwood Premium

function matchesTarget(projectName?: string, projectId?: any): boolean {
  if (projectId !== undefined && projectId !== null) {
    const numId = Number(projectId);
    if (TARGET_PROJECT_IDS.includes(numId)) return true;
  }
  if (projectName && typeof projectName === 'string') {
    const norm = projectName.toLowerCase().trim();
    if (
      norm.includes('shivaji') ||
      norm.includes('keshvam') ||
      norm.includes('redwood premium')
    ) {
      return true;
    }
  }
  return false;
}

async function runDeletion() {
  console.log("=== STARTING FIRESTORE & STORAGE CLEANUP FOR TARGET PROJECTS ===");
  
  const report = {
    deletedProjects: [] as string[],
    deletedPlotsCount: 0,
    deletedBookingsCount: 0,
    deletedLeadsCount: 0,
    deletedCustomersCount: 0,
    deletedCommLogsCount: 0,
    deletedHoldRequestsCount: 0,
    deletedInsightsCount: 0,
    deletedStorageFilesCount: 0,
  };

  // 1. PROJECTS COLLECTION
  console.log("\n--- Checking 'projects' collection ---");
  const projectsSnap = await getDocs(collection(db, 'projects'));
  console.log(`Total projects in Firestore: ${projectsSnap.docs.length}`);

  for (const docSnap of projectsSnap.docs) {
    const data = docSnap.data();
    const pName = data.name || data.title || '';
    const pId = data.id || docSnap.id;

    if (matchesTarget(pName, pId)) {
      console.log(`Deleting project doc ID ${docSnap.id}: "${pName}"`);
      report.deletedProjects.push(`${pName} (Doc ID: ${docSnap.id})`);

      // Check subcollection 'plots' if any
      try {
        const subPlotsSnap = await getDocs(collection(db, 'projects', docSnap.id, 'plots'));
        for (const subPlot of subPlotsSnap.docs) {
          await deleteDoc(doc(db, 'projects', docSnap.id, 'plots', subPlot.id));
          report.deletedPlotsCount++;
        }
      } catch (e) {
        // subcollection might not exist
      }

      // Check subcollection 'inventory' if any
      try {
        const subInvSnap = await getDocs(collection(db, 'projects', docSnap.id, 'inventory'));
        for (const subInv of subInvSnap.docs) {
          await deleteDoc(doc(db, 'projects', docSnap.id, 'inventory', subInv.id));
          report.deletedPlotsCount++;
        }
      } catch (e) {}

      // Delete main project doc
      await deleteDoc(doc(db, 'projects', docSnap.id));
    }
  }

  // 2. PLOT_MAPPINGS COLLECTION
  console.log("\n--- Checking 'plot_mappings' collection ---");
  try {
    const plotMapSnap = await getDocs(collection(db, 'plot_mappings'));
    console.log(`Total plot_mappings docs: ${plotMapSnap.docs.length}`);
    for (const docSnap of plotMapSnap.docs) {
      const data = docSnap.data();
      if (matchesTarget(data.projectName, data.projectId)) {
        await deleteDoc(doc(db, 'plot_mappings', docSnap.id));
        report.deletedPlotsCount++;
      }
    }
  } catch (e) {
    console.log("No plot_mappings collection or query error:", e);
  }

  // 3. BOOKINGS COLLECTION
  console.log("\n--- Checking 'bookings' collection ---");
  try {
    const bookingsSnap = await getDocs(collection(db, 'bookings'));
    console.log(`Total bookings docs: ${bookingsSnap.docs.length}`);
    for (const docSnap of bookingsSnap.docs) {
      const data = docSnap.data();
      const projName = data.projectName || data.project_name || data.project || (data.project && data.project.name);
      const projId = data.projectId || (data.project && data.project.id);
      if (matchesTarget(projName, projId)) {
        console.log(`Deleting booking ID ${docSnap.id} for project ${projName}`);
        await deleteDoc(doc(db, 'bookings', docSnap.id));
        report.deletedBookingsCount++;
      }
    }
  } catch (e) {
    console.log("Error querying bookings:", e);
  }

  // 4. LEADS / CRM RECORDS
  console.log("\n--- Checking 'leads' collection ---");
  try {
    const leadsSnap = await getDocs(collection(db, 'leads'));
    console.log(`Total leads docs: ${leadsSnap.docs.length}`);
    for (const docSnap of leadsSnap.docs) {
      const data = docSnap.data();
      const projName = data.projectName || data.project_name || data.project || data.interestedProject;
      const projId = data.projectId;
      if (matchesTarget(projName, projId)) {
        console.log(`Deleting lead ID ${docSnap.id} for project ${projName}`);
        await deleteDoc(doc(db, 'leads', docSnap.id));
        report.deletedLeadsCount++;
      }
    }
  } catch (e) {
    console.log("Error querying leads:", e);
  }

  // 5. CUSTOMERS COLLECTION
  console.log("\n--- Checking 'customers' collection ---");
  try {
    const custSnap = await getDocs(collection(db, 'customers'));
    console.log(`Total customers docs: ${custSnap.docs.length}`);
    for (const docSnap of custSnap.docs) {
      const data = docSnap.data();
      const projName = data.projectName || data.project_name || data.project;
      const projId = data.projectId;
      if (matchesTarget(projName, projId)) {
        console.log(`Deleting customer ID ${docSnap.id} for project ${projName}`);
        await deleteDoc(doc(db, 'customers', docSnap.id));
        report.deletedCustomersCount++;
      }
    }
  } catch (e) {
    console.log("Error querying customers:", e);
  }

  // 6. COMMUNICATION LOGS COLLECTION
  console.log("\n--- Checking 'communication_logs' collection ---");
  try {
    const commSnap = await getDocs(collection(db, 'communication_logs'));
    console.log(`Total comm_logs docs: ${commSnap.docs.length}`);
    for (const docSnap of commSnap.docs) {
      const data = docSnap.data();
      const projName = data.projectName || data.project_name || data.project;
      const projId = data.projectId;
      if (matchesTarget(projName, projId)) {
        await deleteDoc(doc(db, 'communication_logs', docSnap.id));
        report.deletedCommLogsCount++;
      }
    }
  } catch (e) {
    console.log("Error querying comm_logs:", e);
  }

  // 7. HOLD REQUESTS COLLECTION
  console.log("\n--- Checking 'hold_requests' collection ---");
  try {
    const holdSnap = await getDocs(collection(db, 'hold_requests'));
    console.log(`Total hold_requests docs: ${holdSnap.docs.length}`);
    for (const docSnap of holdSnap.docs) {
      const data = docSnap.data();
      const projName = data.projectName || data.project_name || data.project;
      const projId = data.projectId;
      if (matchesTarget(projName, projId)) {
        await deleteDoc(doc(db, 'hold_requests', docSnap.id));
        report.deletedHoldRequestsCount++;
      }
    }
  } catch (e) {
    console.log("Error querying hold_requests:", e);
  }

  // 8. INSIGHTS / AUDIT LOGS
  console.log("\n--- Checking 'insights' collection ---");
  try {
    const insightSnap = await getDocs(collection(db, 'insights'));
    console.log(`Total insights docs: ${insightSnap.docs.length}`);
    for (const docSnap of insightSnap.docs) {
      const data = docSnap.data();
      const projName = data.projectName || data.project_name || data.project || data.title || data.description;
      const projId = data.projectId;
      if (matchesTarget(projName, projId)) {
        await deleteDoc(doc(db, 'insights', docSnap.id));
        report.deletedInsightsCount++;
      }
    }
  } catch (e) {
    console.log("Error querying insights:", e);
  }

  // 9. FIREBASE STORAGE
  console.log("\n--- Checking Firebase Storage ---");
  try {
    const listFolder = async (folderRef: any) => {
      const res = await listAll(folderRef);
      for (const itemRef of res.items) {
        const fullPath = itemRef.fullPath.toLowerCase();
        if (
          fullPath.includes('shivaji') ||
          fullPath.includes('keshvam') ||
          fullPath.includes('redwood_premium') ||
          fullPath.includes('redwood-premium') ||
          fullPath.includes('project_2/') ||
          fullPath.includes('project_8/') ||
          fullPath.includes('project_12/')
        ) {
          console.log(`Deleting storage file: ${itemRef.fullPath}`);
          await deleteObject(itemRef);
          report.deletedStorageFilesCount++;
        }
      }
      for (const folder of res.prefixes) {
        await listFolder(folder);
      }
    };

    const rootRef = ref(storage, '/');
    await listFolder(rootRef);
  } catch (e) {
    console.log("Storage scan complete or no storage items found / error:", e);
  }

  console.log("\n=================== DELETION REPORT ===================");
  console.log(JSON.stringify(report, null, 2));
  console.log("=======================================================");
}

runDeletion().catch(err => {
  console.error("FATAL SCRIPT ERROR:", err);
  process.exit(1);
});

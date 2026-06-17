"use client"

import { notify } from "@/lib/notify";;

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Download,
    Upload,
    Loader2,
    CheckCircle,
    AlertTriangle,
    Database,
    Calendar,
    FileJson,
    RefreshCw,
    Clock,
    FolderOpen
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
// Tables to backup/restore (in dependency order)
const TABLES = [
    'profiles',
    'clients',
    'suppliers',
    'inventory',
    'jobs',
    'purchases',
    'purchase_items',
    'workers',
    'attendance',
    'delivery_notes',
    'delivery_note_items',
];

interface BackupData {
    timestamp: string;
    tables: { [key: string]: any[] };
    totalRecords: number;
}

interface GitHubBackup {
    name: string;
    path: string;
    date: Date;
    downloadUrl: string;
}

export default function BackupSettingsPage() {
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [backupData, setBackupData] = useState<BackupData | null>(null);
    const [backupStatus, setBackupStatus] = useState<string>("");
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [restoreData, setRestoreData] = useState<BackupData | null>(null);
    const [selectedTable, setSelectedTable] = useState<string>("all");
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [restoreStatus, setRestoreStatus] = useState<string>("");

    // GitHub backups state
    const [githubBackups, setGithubBackups] = useState<GitHubBackup[]>([]);
    const [loadingGithubBackups, setLoadingGithubBackups] = useState(true);
    const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null);

    // Load GitHub backups on mount
    useEffect(() => {
        loadGithubBackups();
    }, []);

    // Fetch backups from GitHub repository
    const loadGithubBackups = async () => {
        setLoadingGithubBackups(true);
        try {
            // Fetch backup folders from GitHub API
            const response = await fetch(
                'https://api.github.com/repos/ilsenzanima/MagazzinoV5_5/contents/backups',
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch backups');
            }

            const folders = await response.json();

            // Filter only directories (backup folders)
            const backupFolders = folders
                .filter((item: any) => item.type === 'dir' && item.name.match(/^\d{4}-\d{2}-\d{2}/))
                .map((folder: any) => {
                    // Parse date from folder name (format: 2026-01-14T19-45)
                    const dateParts = folder.name.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/);
                    let date = new Date();
                    if (dateParts) {
                        date = new Date(
                            parseInt(dateParts[1]),
                            parseInt(dateParts[2]) - 1,
                            parseInt(dateParts[3]),
                            parseInt(dateParts[4]),
                            parseInt(dateParts[5])
                        );
                    }

                    return {
                        name: folder.name,
                        path: folder.path,
                        date,
                        downloadUrl: folder.url
                    };
                })
                .sort((a: GitHubBackup, b: GitHubBackup) => b.date.getTime() - a.date.getTime());

            setGithubBackups(backupFolders);
        } catch (error) {
            console.error('Error loading GitHub backups:', error);
            notify.error("Errore nel caricamento dei backup");
            setGithubBackups([]);
        } finally {
            setLoadingGithubBackups(false);
        }
    };

    // Download a specific backup from GitHub
    const downloadGithubBackup = async (backup: GitHubBackup) => {
        setDownloadingBackup(backup.name);
        try {
            // Fetch the list of files in the backup folder
            const response = await fetch(backup.downloadUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch backup contents');
            }

            const files = await response.json();

            // Create a combined backup object
            const combinedBackup: BackupData = {
                timestamp: backup.date.toISOString(),
                tables: {},
                totalRecords: 0
            };

            // Download each JSON file
            for (const file of files) {
                if (file.name.endsWith('.json')) {
                    const tableName = file.name.replace('.json', '');
                    const fileResponse = await fetch(file.download_url);
                    const tableData = await fileResponse.json();
                    combinedBackup.tables[tableName] = tableData;
                    combinedBackup.totalRecords += tableData.length;
                }
            }

            // Create and download the combined file
            const blob = new Blob([JSON.stringify(combinedBackup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${backup.name}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error downloading backup:', error);
            notify.error('Errore durante il download del backup');
        } finally {
            setDownloadingBackup(null);
        }
    };

    // Backup all tables
    const handleBackup = async () => {
        setIsBackingUp(true);
        setBackupStatus("Avvio backup...");

        try {
            const backup: BackupData = {
                timestamp: new Date().toISOString(),
                tables: {},
                totalRecords: 0
            };

            for (const table of TABLES) {
                setBackupStatus(`Backup ${table}...`);

                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .order('created_at', { ascending: true });

                if (error) {
                    console.error(`Error backing up ${table}:`, error);
                    backup.tables[table] = [];
                } else {
                    backup.tables[table] = data || [];
                    backup.totalRecords += data?.length || 0;
                }
            }

            setBackupData(backup);
            setBackupStatus(`Backup completato! ${backup.totalRecords} record totali`);

            // Auto-download
            downloadBackup(backup);

        } catch (error) {
            console.error("Backup error:", error);
            setBackupStatus("Errore durante il backup");
        } finally {
            setIsBackingUp(false);
        }
    };

    // Download backup as JSON
    const downloadBackup = (data: BackupData) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Handle file upload for restore
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setRestoreFile(file);

        try {
            const text = await file.text();
            const data = JSON.parse(text) as BackupData;

            if (!data.timestamp || !data.tables) {
                throw new Error("File di backup non valido");
            }

            setRestoreData(data);
            setRestoreStatus(`File caricato: ${data.totalRecords} record da ${new Date(data.timestamp).toLocaleString('it-IT')}`);
        } catch (error) {
            console.error("Error parsing backup file:", error);
            setRestoreStatus("Errore: File di backup non valido");
            setRestoreData(null);
        }
    };

    // Perform restore
    const handleRestore = async () => {
        if (!restoreData) return;

        setShowRestoreConfirm(false);
        setIsRestoring(true);
        setRestoreStatus("Avvio ripristino...");

        try {
            const tablesToRestore = selectedTable === "all"
                ? TABLES
                : [selectedTable];

            let totalRestored = 0;

            for (const table of tablesToRestore) {
                const tableData = restoreData.tables[table];
                if (!tableData || tableData.length === 0) {
                    setRestoreStatus(`${table}: nessun dato, saltato`);
                    continue;
                }

                setRestoreStatus(`Ripristino ${table} (${tableData.length} record)...`);

                // Delete existing data
                const { error: deleteError } = await supabase
                    .from(table)
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');

                if (deleteError) {
                    console.error(`Error clearing ${table}:`, deleteError);
                    continue;
                }

                // Insert in batches
                const batchSize = 50;
                for (let i = 0; i < tableData.length; i += batchSize) {
                    const batch = tableData.slice(i, i + batchSize);
                    const { error: insertError } = await supabase
                        .from(table)
                        .insert(batch);

                    if (insertError) {
                        console.error(`Error inserting into ${table}:`, insertError);
                    } else {
                        totalRestored += batch.length;
                    }
                }
            }

            setRestoreStatus(`✅ Ripristino completato! ${totalRestored} record ripristinati`);

        } catch (error) {
            console.error("Restore error:", error);
            setRestoreStatus("❌ Errore durante il ripristino");
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Backup e Ripristino</h3>
                <p className="text-sm text-muted-foreground">
                    Gestisci i backup del database. Il backup automatico viene eseguito ogni domenica notte.
                </p>
            </div>
            <Separator />

            <div className="space-y-6">
                {/* GitHub Backups Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FolderOpen className="h-5 w-5" />
                            Backup Precedenti
                        </CardTitle>
                        <CardDescription>
                            Scarica un backup precedente dal repository. I backup vengono creati automaticamente ogni domenica.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-muted-foreground">
                                {githubBackups.length} backup disponibili
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadGithubBackups}
                                disabled={loadingGithubBackups}
                            >
                                {loadingGithubBackups ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                <span className="ml-2">Aggiorna</span>
                            </Button>
                        </div>

                        {loadingGithubBackups ? (
                            <div className="flex items-center gap-2 text-muted-foreground py-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Caricamento backup...
                            </div>
                        ) : githubBackups.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic py-4">
                                Nessun backup trovato nel repository.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {githubBackups.map((backup) => (
                                    <div
                                        key={backup.name}
                                        className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {backup.date.toLocaleDateString('it-IT', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {backup.date.toLocaleTimeString('it-IT', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => downloadGithubBackup(backup)}
                                            disabled={downloadingBackup === backup.name}
                                        >
                                            {downloadingBackup === backup.name ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Download className="h-4 w-4" />
                                            )}
                                            <span className="ml-2">Scarica</span>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Manual Backup Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5" />
                            Backup Manuale
                        </CardTitle>
                        <CardDescription>
                            Scarica una copia completa di tutti i dati correnti in formato JSON.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={handleBackup}
                            disabled={isBackingUp}
                            className="w-full sm:w-auto"
                        >
                            {isBackingUp ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {backupStatus}
                                </>
                            ) : (
                                <>
                                    <Database className="mr-2 h-4 w-4" />
                                    Scarica Backup Completo
                                </>
                            )}
                        </Button>

                        {backupData && !isBackingUp && (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm">{backupStatus}</span>
                            </div>
                        )}

                        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium text-sm mb-2">Tabelle incluse nel backup:</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                                {TABLES.map(table => (
                                    <div key={table} className="flex items-center gap-1">
                                        <FileJson className="h-3 w-3" />
                                        {table}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Restore Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Ripristino Dati
                        </CardTitle>
                        <CardDescription>
                            Ripristina i dati da un file di backup precedente.
                            <span className="text-amber-600 dark:text-amber-400 font-medium block mt-1">
                                ⚠️ Attenzione: il ripristino sovrascriverà i dati esistenti!
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* File Upload */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                1. Seleziona il file di backup
                            </label>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
                            />
                        </div>

                        {/* Restore options */}
                        {restoreData && (
                            <>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                        <Calendar className="h-4 w-4" />
                                        <span className="text-sm font-medium">
                                            Backup del {new Date(restoreData.timestamp).toLocaleString('it-IT')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                                        {restoreData.totalRecords} record totali
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        2. Scegli cosa ripristinare
                                    </label>
                                    <Select value={selectedTable} onValueChange={setSelectedTable}>
                                        <SelectTrigger className="w-full sm:w-64">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tutte le tabelle</SelectItem>
                                            {TABLES.map(table => (
                                                <SelectItem key={table} value={table}>
                                                    {table} ({restoreData.tables[table]?.length || 0} record)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={() => setShowRestoreConfirm(true)}
                                    disabled={isRestoring}
                                    variant="destructive"
                                    className="w-full sm:w-auto"
                                >
                                    {isRestoring ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {restoreStatus}
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Ripristina {selectedTable === "all" ? "Tutto" : selectedTable}
                                        </>
                                    )}
                                </Button>
                            </>
                        )}

                        {restoreStatus && !isRestoring && (
                            <div className={`flex items-center gap-2 ${restoreStatus.includes('✅')
                                ? 'text-green-600 dark:text-green-400'
                                : restoreStatus.includes('❌')
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-muted-foreground'
                                }`}>
                                <span className="text-sm">{restoreStatus}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Confirm Dialog */}
            <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Conferma Ripristino
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Stai per ripristinare {selectedTable === "all" ? "TUTTE le tabelle" : `la tabella "${selectedTable}"`}.
                            <br /><br />
                            <strong className="text-foreground">
                                Questa azione eliminerà i dati correnti e li sostituirà con quelli del backup.
                            </strong>
                            <br /><br />
                            Sei sicuro di voler continuare?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sì, Ripristina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

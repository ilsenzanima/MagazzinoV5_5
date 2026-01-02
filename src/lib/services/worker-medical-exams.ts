import { supabase } from '@/lib/supabase';
import { WorkerMedicalExam } from '@/lib/types';

const mapDbToExam = (db: any): WorkerMedicalExam => ({
    id: db.id,
    workerId: db.worker_id,
    examDate: db.exam_date,
    nextExamDate: db.next_exam_date,
    doctorName: db.doctor_name,
    notes: db.notes,
    createdAt: db.created_at,
    updatedAt: db.updated_at
});

const mapExamToDb = (exam: Partial<WorkerMedicalExam>) => ({
    worker_id: exam.workerId,
    exam_date: exam.examDate,
    next_exam_date: exam.nextExamDate,
    doctor_name: exam.doctorName,
    notes: exam.notes
});

export const workerMedicalExamsApi = {
    // Get all exams for a specific worker
    getByWorkerId: async (workerId: string): Promise<WorkerMedicalExam[]> => {
        const { data, error } = await supabase
            .from('worker_medical_exams')
            .select('*')
            .eq('worker_id', workerId)
            .order('exam_date', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapDbToExam);
    },

    // Get latest exam for a worker
    getLatest: async (workerId: string): Promise<WorkerMedicalExam | null> => {
        const { data, error } = await supabase
            .from('worker_medical_exams')
            .select('*')
            .eq('worker_id', workerId)
            .order('exam_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data ? mapDbToExam(data) : null;
    },

    // Create a new exam
    create: async (exam: Partial<WorkerMedicalExam>): Promise<WorkerMedicalExam> => {
        const { data, error } = await supabase
            .from('worker_medical_exams')
            .insert(mapExamToDb(exam))
            .select()
            .single();

        if (error) throw error;
        return mapDbToExam(data);
    },

    // Update an existing exam
    update: async (id: string, exam: Partial<WorkerMedicalExam>): Promise<WorkerMedicalExam> => {
        const updateData: any = { ...mapExamToDb(exam), updated_at: new Date().toISOString() };
        // Remove undefined values
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const { data, error } = await supabase
            .from('worker_medical_exams')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapDbToExam(data);
    },

    // Delete an exam
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('worker_medical_exams')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

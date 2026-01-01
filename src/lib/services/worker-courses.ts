import { supabase } from '@/lib/supabase';
import { WorkerCourse } from '@/lib/types';

const mapDbToCourse = (db: any): WorkerCourse => ({
    id: db.id,
    workerId: db.worker_id,
    courseName: db.course_name,
    completionDate: db.completion_date,
    validityYears: db.validity_years,
    createdAt: db.created_at,
    updatedAt: db.updated_at
});

const mapCourseToDb = (course: Partial<WorkerCourse>) => ({
    worker_id: course.workerId,
    course_name: course.courseName,
    completion_date: course.completionDate,
    validity_years: course.validityYears
});

export const workerCoursesApi = {
    // Get all courses for a specific worker
    getByWorkerId: async (workerId: string): Promise<WorkerCourse[]> => {
        const { data, error } = await supabase
            .from('worker_courses')
            .select('*')
            .eq('worker_id', workerId)
            .order('course_name', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapDbToCourse);
    },

    // Get all unique course names (for autocomplete/dropdown)
    getAllCourseNames: async (): Promise<string[]> => {
        const { data, error } = await supabase
            .from('worker_courses')
            .select('course_name')
            .order('course_name', { ascending: true });

        if (error) throw error;

        // Return unique course names
        const uniqueNames = [...new Set((data || []).map(d => d.course_name))];
        return uniqueNames;
    },

    // Create a new course
    create: async (course: Partial<WorkerCourse>): Promise<WorkerCourse> => {
        const { data, error } = await supabase
            .from('worker_courses')
            .insert(mapCourseToDb(course))
            .select()
            .single();

        if (error) throw error;
        return mapDbToCourse(data);
    },

    // Update an existing course
    update: async (id: string, course: Partial<WorkerCourse>): Promise<WorkerCourse> => {
        const updateData: any = { ...mapCourseToDb(course), updated_at: new Date().toISOString() };
        // Remove undefined values
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const { data, error } = await supabase
            .from('worker_courses')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapDbToCourse(data);
    },

    // Delete a course
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('worker_courses')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Create or update a course (upsert by worker_id + course_name)
    upsertByName: async (workerId: string, courseName: string, completionDate: string, validityYears: number): Promise<WorkerCourse> => {
        // Check if course exists for this worker
        const { data: existing } = await supabase
            .from('worker_courses')
            .select('*')
            .eq('worker_id', workerId)
            .eq('course_name', courseName)
            .single();

        if (existing) {
            // Update existing course
            return workerCoursesApi.update(existing.id, {
                completionDate,
                validityYears
            });
        } else {
            // Create new course
            return workerCoursesApi.create({
                workerId,
                courseName,
                completionDate,
                validityYears
            });
        }
    }
};

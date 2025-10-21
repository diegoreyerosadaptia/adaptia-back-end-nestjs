import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    DeleteDateColumn,
  } from 'typeorm';
  import { Organization } from 'src/organizations/entities/organization.entity';
  
  export const ANALYSIS_STATUS = ['PENDING', 'COMPLETED'] as const;
  export type AnalysisStatus = (typeof ANALYSIS_STATUS)[number];
  
  export const PAYMENT_STATUS = ['PENDING', 'COMPLETED'] as const;
  export type PaymentStatus = (typeof PAYMENT_STATUS)[number];
  
  @Entity({ name: 'analysis' })
  export class Analysis {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'uuid', nullable: false })
    organization_id: string;
  
    @Column('enum', { enum: ANALYSIS_STATUS, default: ANALYSIS_STATUS[0] })
    status: AnalysisStatus;
  
    @Column('enum', { enum: PAYMENT_STATUS, default: PAYMENT_STATUS[0] })
    payment_status: PaymentStatus;
  
    @ManyToOne(() => Organization, (organization) => organization.analysis, {
      onDelete: 'CASCADE',
    })
    organization: Organization;

    @DeleteDateColumn()
    deletedAt: Date;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }
  
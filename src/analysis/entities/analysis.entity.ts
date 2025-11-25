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
  
  export const ANALYSIS_STATUS = ['PENDING', 'COMPLETED', 'FAILED', 'INCOMPLETE', 'PROCESSING'] as const;
  export type AnalysisStatus = (typeof ANALYSIS_STATUS)[number];
  
  export const PAYMENT_STATUS = ['PENDING', 'COMPLETED'] as const;
  export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

  export const SHIPPING_STATUS = ['SENT', 'NOT_SEND'] as const;
  export type ShippingStatus = (typeof SHIPPING_STATUS)[number];
  
  @Entity({ name: 'analysis' })
  export class Analysis {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column('enum', { enum: ANALYSIS_STATUS, default: ANALYSIS_STATUS[0] })
    status: AnalysisStatus;
  
    @Column('enum', { enum: PAYMENT_STATUS, default: PAYMENT_STATUS[0] })
    payment_status: PaymentStatus;

    @Column('enum', { enum: SHIPPING_STATUS, default: SHIPPING_STATUS[1] })
    shipping_status: ShippingStatus;
  
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
  
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm'
  
  @Entity('coupons')
  export class Coupon {
    @PrimaryGeneratedColumn('uuid')
    id: string
  
    // Nombre del cupón (ej: "BIENVENIDA10", "BLACKFRIDAY")
    @Column({ unique: true })
    name: string
  
    // Porcentaje de descuento (ej: 10 = 10%)
    @Column('decimal', { precision: 5, scale: 2 })
    percentage: number
  
    // Opcional: auditoría básica
    @CreateDateColumn()
    createdAt: Date
  
    @UpdateDateColumn()
    updatedAt: Date
  }
  